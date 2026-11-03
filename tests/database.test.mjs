import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
test("SQL: permissões, privacidade, contas inativas, transação e trocas", async (t) => {
  const db = new PGlite();
  const q = (sql, params = []) => db.query(sql, params);
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
      INSERT INTO storage.buckets(id,file_size_limit) VALUES ('avatars',2097152);
    `);
    const dir = new URL("../drizzle/migrations/", import.meta.url);
    for (const name of (await readdir(dir))
      .filter((n) => n.endsWith(".sql") && !n.includes("enable_pg_cron"))
      .sort()) {
      await db.exec(await readFile(new URL(name, dir), "utf8"));
    }
    const session = async (role, user = null) => {
      await db.exec("RESET ROLE");
      await q("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
      await db.exec(`SET ROLE ${role}`);
    };
    for (let n = 1; n <= 6; n++)
      await q("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,$2,$3)", [
        id(n),
        `pessoa${n}@example.invalid`,
        JSON.stringify({ full_name: `Pessoa ${n}` }),
      ]);
    await q("UPDATE profiles SET role='admin' WHERE id=$1", [id(1)]);
    await q("UPDATE profiles SET role='lider' WHERE id=$1", [id(2)]);
    await q("UPDATE profiles SET active=false WHERE id=$1", [id(6)]);
    const mid = id(100),
      other = id(101),
      eid = id(200),
      eid2 = id(201);
    await q("INSERT INTO ministries(id,name) VALUES ($1,'Teste'),($2,'Outro')", [mid, other]);
    for (const n of [2, 3, 4, 6])
      await q("INSERT INTO user_ministries(user_id,ministry_id) VALUES ($1,$2)", [id(n), mid]);
    await q("INSERT INTO ministry_leaders(user_id,ministry_id) VALUES ($1,$2)", [id(2), mid]);
    await q("INSERT INTO user_ministries(user_id,ministry_id) VALUES ($1,$2)", [id(5), other]);
    await q(
      "INSERT INTO events(id,name,date,start_time,end_time) VALUES ($1,'Evento','2099-11-05','19:00','21:00'),($2,'Conflito','2099-11-05','20:00','22:00')",
      [eid, eid2],
    );

    await t.test("anon não executa RPCs sensíveis", async () => {
      for (const fn of [
        "respond_schedule(uuid,text)",
        "respond_substitution(uuid,boolean)",
        "save_schedule(uuid,uuid,uuid[],boolean,integer)",
        "list_people()",
      ]) {
        const r = await q("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed", [
          `public.${fn}`,
        ]);
        assert.equal(r.rows[0].allowed, false);
      }
      await session("anon");
      await assert.rejects(
        q("SELECT respond_schedule($1,'confirmed')", [id(999)]),
        /permission denied/,
      );
      await session("authenticated");
      await assert.rejects(q("SELECT respond_schedule($1,'confirmed')", [id(999)]), /conta ativa/);
    });
    await t.test("contatos mascarados e sem SELECT direto", async () => {
      await session("authenticated", id(3));
      const r = await q("SELECT email,phone FROM list_people() WHERE id=$1", [id(4)]);
      assert.equal(r.rows[0].email, "");
      assert.equal(r.rows[0].phone, null);
      await assert.rejects(q("SELECT email FROM profiles"), /permission denied/);
      await session("authenticated", id(2));
      assert.equal(
        (await q("SELECT email FROM list_people() WHERE id=$1", [id(4)])).rows[0].email,
        "pessoa4@example.invalid",
      );
      await session("authenticated", id(5));
      assert.equal((await q("SELECT * FROM list_people() WHERE id=$1", [id(4)])).rows.length, 0);
    });
    await t.test("inativo só consulta o próprio perfil e não altera disponibilidade", async () => {
      await session("authenticated", id(6));
      assert.equal((await q("SELECT * FROM user_ministries")).rows.length, 0);
      assert.equal((await q("SELECT * FROM list_people()")).rows.length, 1);
      await assert.rejects(
        q("INSERT INTO availability(user_id,date,available) VALUES ($1,'2099-11-05',true)", [
          id(6),
        ]),
        /row-level security/,
      );
      await assert.rejects(
        q("SELECT save_schedule($1,$2,$3,true,1)", [eid, mid, [id(3)]]),
        /conta ativa/,
      );
    });
    await t.test(
      "salvamento transacional preserva escala quando um membro é inválido",
      async () => {
        await session("authenticated", id(1));
        await q("SELECT save_schedule($1,$2,$3,true,1)", [eid, mid, [id(3)]]);
        await assert.rejects(
          q("SELECT save_schedule($1,$2,$3,true,1)", [eid, mid, [id(6)]]),
          /membro ativo/,
        );
        const r = await q("SELECT status FROM schedules WHERE event_id=$1 AND user_id=$2", [
          eid,
          id(3),
        ]);
        assert.equal(r.rows[0].status, "scheduled");
      },
    );
    await t.test("conflito em outro evento é bloqueado no banco", async () => {
      await session("authenticated", id(1));
      await assert.rejects(
        q("SELECT save_schedule($1,$2,$3,true,1)", [eid2, mid, [id(3)]]),
        /conflitante/,
      );
      assert.equal((await q("SELECT * FROM schedules WHERE event_id=$1", [eid2])).rows.length, 0);
    });
    await t.test("aprovação revalida disponibilidade sem substituir escala original", async () => {
      await session("authenticated", id(3));
      const sid = (
        await q("SELECT id FROM schedules WHERE event_id=$1 AND user_id=$2", [eid, id(3)])
      ).rows[0].id;
      const rid = (await q("SELECT request_substitution($1,$2,NULL) AS id", [sid, id(4)])).rows[0]
        .id;
      await session("authenticated", id(4));
      const pedido = (
        await q("SELECT title,body FROM notifications WHERE type=$1", ["troca_pedido:" + rid])
      ).rows[0];
      assert.equal(pedido.title, "Pedido de substituição");
      assert.match(pedido.body, /05\/11\/2099 às 19:00/);
      assert.match(pedido.body, /Pessoa 3 pediu sua ajuda/);
      await q("SELECT respond_substitution($1,true)", [rid]);
      await q("INSERT INTO availability(user_id,date,available) VALUES ($1,'2099-11-05',false)", [
        id(4),
      ]);
      await session("authenticated", id(2));
      await assert.rejects(q("SELECT decide_substitution($1,true)", [rid]), /disponibilidade/);
      assert.equal(
        (await q("SELECT status FROM schedules WHERE id=$1", [sid])).rows[0].status,
        "scheduled",
      );
    });
    await t.test("mensal: permissões, vagas, revisão manual, preservação e rollback", async () => {
      await session("postgres");
      const ma = id(300),
        mb = id(301);
      await q(
        "INSERT INTO events(id,name,date,start_time,end_time) VALUES ($1,'Mensal A',(date_trunc('month',now() AT TIME ZONE 'America/Fortaleza')+interval '1 month'-interval '1 day')::date,'23:59:00','01:00:00'),($2,'Mensal B',(date_trunc('month',now() AT TIME ZONE 'America/Fortaleza')+interval '1 month'-interval '1 day')::date,'23:59:30','01:00:00')",
        [ma, mb],
      );
      const month = (
        await q(
          "SELECT date_trunc('month',now() AT TIME ZONE 'America/Fortaleza')::date::text AS month",
        )
      ).rows[0].month;
      const date = (await q("SELECT date::text AS date FROM events WHERE id=$1", [ma])).rows[0]
        .date;
      await q("INSERT INTO availability(user_id,date,available) VALUES ($1,$2,true)", [
        id(3),
        date,
      ]);
      await session("anon");
      await assert.rejects(q("SELECT month_schedule_context($1)", [mid]), /permission denied/);
      await session("authenticated", id(5));
      await assert.rejects(q("SELECT month_schedule_context($1)", [mid]), /não gerencia/);
      await session("authenticated", id(2));
      const ctx = (await q("SELECT month_schedule_context($1) AS ctx", [mid])).rows[0].ctx;
      assert.equal(ctx.month, month);
      assert.equal(
        ctx.events.some((e) => e.id === ma),
        true,
      );
      assert.equal(
        ctx.people.some((p) => p.id === id(6)),
        false,
      );
      let plan = [
        {
          event_id: ma,
          required_count: 2,
          existing_ids: [],
          selections: [{ user_id: id(3), manual_confirmed: false }],
          confirmed_existing: [],
        },
      ];
      await assert.rejects(
        q("SELECT save_month_schedule($1,$2,$3,true)", [mid, month, JSON.stringify(plan)]),
        /pendentes/,
      );
      await q("SELECT save_month_schedule($1,$2,$3,false)", [mid, month, JSON.stringify(plan)]);
      const saved = (await q("SELECT id,status FROM schedules WHERE event_id=$1", [ma])).rows[0];
      assert.equal(saved.status, "draft");
      await assert.rejects(
        q("SELECT save_month_schedule($1,$2,$3,false)", [mid, month, JSON.stringify(plan)]),
        /outro gestor/,
      );
      plan = [
        {
          event_id: ma,
          required_count: 2,
          existing_ids: [saved.id],
          selections: [{ user_id: id(4), manual_confirmed: false }],
          confirmed_existing: [],
        },
      ];
      await assert.rejects(
        q("SELECT save_month_schedule($1,$2,$3,true)", [mid, month, JSON.stringify(plan)]),
        /Confirme/,
      );
      // A segunda linha conflita com a primeira: a gravação do mês inteiro deve reverter.
      plan[0].selections[0].manual_confirmed = true;
      const conflict = [
        ...plan,
        {
          event_id: mb,
          required_count: 1,
          existing_ids: [],
          selections: [{ user_id: id(4), manual_confirmed: true }],
          confirmed_existing: [],
        },
      ];
      await assert.rejects(
        q("SELECT save_month_schedule($1,$2,$3,true)", [mid, month, JSON.stringify(conflict)]),
        /conflitante/,
      );
      assert.equal(
        (await q("SELECT count(*)::int AS n FROM schedules WHERE event_id=$1", [ma])).rows[0].n,
        1,
      );
      assert.equal(
        (await q("SELECT status FROM schedules WHERE id=$1", [saved.id])).rows[0].status,
        "draft",
      );
      await q("SELECT save_month_schedule($1,$2,$3,true)", [mid, month, JSON.stringify(plan)]);
      assert.equal(
        (
          await q(
            "SELECT count(*)::int AS n FROM schedules WHERE event_id=$1 AND status='scheduled'",
            [ma],
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (await q("SELECT id FROM schedules WHERE id=$1", [saved.id])).rows[0].id,
        saved.id,
      );
      await session("authenticated", id(6));
      await assert.rejects(q("SELECT month_schedule_context($1)", [mid]), /conta ativa/);
    });
    await t.test(
      "avisos: publicação, rascunho, horários exatos, preferências e duplicidade",
      async () => {
        await session("postgres");
        const event24 = id(400),
          event2 = id(401),
          draft = id(402),
          short = id(403);
        await q(
          "INSERT INTO events(id,name,date,start_time,end_time) SELECT $1,'Culto de teste',(local_start)::date,local_start::time,(local_start+interval '1 hour')::time FROM (SELECT date_trunc('minute',now() AT TIME ZONE 'America/Fortaleza')+interval '24 hours'-interval '1 minute' local_start)x",
          [event24],
        );
        await q(
          "INSERT INTO events(id,name,date,start_time,end_time) SELECT $1,'Culto de teste',(local_start)::date,local_start::time,(local_start+interval '1 hour')::time FROM (SELECT date_trunc('minute',now() AT TIME ZONE 'America/Fortaleza')+interval '2 hours'-interval '1 minute' local_start)x",
          [event2],
        );
        await q(
          "INSERT INTO events(id,name,date,start_time,end_time) SELECT $1,'Culto de teste',(local_start)::date,local_start::time,(local_start+interval '1 hour')::time FROM (SELECT date_trunc('minute',now() AT TIME ZONE 'America/Fortaleza')+interval '30 minutes' local_start)x",
          [short],
        );
        for (const eid of [event24, event2, short])
          await q(
            "INSERT INTO availability(user_id,date,available) SELECT $1,date,true FROM events WHERE id=$2 ON CONFLICT(user_id,date) DO UPDATE SET available=true",
            [id(3), eid],
          );
        await session("authenticated", id(2));
        await q("SELECT save_schedule($1,$2,$3,false,1)", [event24, mid, [id(3)]]);
        assert.equal(
          (await q("SELECT count(*)::int n FROM notifications WHERE event_id=$1", [event24]))
            .rows[0].n,
          0,
        );
        await q("SELECT save_schedule($1,$2,$3,true,1)", [event24, mid, [id(3)]]);
        await q("SELECT save_schedule($1,$2,$3,true,1)", [event24, mid, [id(3)]]);
        await session("postgres");
        let note = (
          await q(
            "SELECT title,body FROM notifications WHERE event_id=$1 AND type='schedule_published'",
            [event24],
          )
        ).rows;
        assert.equal(note.length, 1);
        assert.equal(note[0].title, "Você foi escalado");
        assert.match(note[0].body, /Fortaleza/);
        assert.doesNotMatch(note[0].body, /amanhã/);
        await q(
          "INSERT INTO schedules(event_id,ministry_id,user_id,status) VALUES($1,$2,$3,'scheduled'),($4,$2,$3,'scheduled')",
          [event2, mid, id(3), short],
        );
        await q("SELECT process_schedule_reminders()");
        await q("SELECT process_schedule_reminders()");
        assert.equal(
          (
            await q(
              "SELECT count(*)::int n FROM notifications WHERE event_id=$1 AND type LIKE 'reminder_24h:%'",
              [event24],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await q(
              "SELECT count(*)::int n FROM notifications WHERE event_id=$1 AND type LIKE 'reminder_2h:%'",
              [event2],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await q(
              "SELECT count(*)::int n FROM notifications WHERE event_id=$1 AND type LIKE 'reminder_%'",
              [short],
            )
          ).rows[0].n,
          0,
        );
        note = (
          await q(
            "SELECT body FROM notifications WHERE event_id=$1 AND type LIKE 'reminder_2h:%'",
            [event2],
          )
        ).rows[0];
        const expected = (
          await q(
            "SELECT to_char(date,'DD/MM/YYYY')||' às '||to_char(start_time,'HH24:MI') value FROM events WHERE id=$1",
            [event2],
          )
        ).rows[0].value;
        assert.ok(note.body.startsWith(expected));
        assert.doesNotMatch(note.body, /em 2 horas|amanhã/);
        // A changed event time gets a fresh reminder identity; inactive profiles are filtered.
        await q("UPDATE events SET start_time=start_time-interval '1 minute' WHERE id=$1", [
          event2,
        ]);
        await q("UPDATE profiles SET reminders_enabled=false WHERE id=$1", [id(3)]);
        await q("SELECT process_schedule_reminders()");
        assert.equal(
          (
            await q(
              "SELECT count(*)::int n FROM notifications WHERE event_id=$1 AND type LIKE 'reminder_2h:%'",
              [event2],
            )
          ).rows[0].n,
          1,
        );
        await q("UPDATE profiles SET reminders_enabled=true WHERE id=$1", [id(3)]);
        await q("SELECT process_schedule_reminders()");
        assert.equal(
          (
            await q(
              "SELECT count(*)::int n FROM notifications WHERE event_id=$1 AND type LIKE 'reminder_2h:%'",
              [event2],
            )
          ).rows[0].n,
          2,
        );
        await q("UPDATE events SET name='Culto revisado' WHERE id=$1", [event2]);
        assert.equal(
          (
            await q(
              "SELECT count(*)::int n FROM notifications WHERE event_id=$1 AND title='Evento atualizado'",
              [event2],
            )
          ).rows[0].n,
          2,
        );
        await q("UPDATE events SET status='cancelled' WHERE id=$1", [event2]);
        const cancelled = (
          await q("SELECT body FROM notifications WHERE event_id=$1 AND title='Evento cancelado'", [
            event2,
          ])
        ).rows[0];
        assert.match(cancelled.body, /não precisa servir/);
        await q(
          "INSERT INTO notifications(user_id,type,title,body,channel) VALUES($1,'test','Teste','Teste','app')",
          [id(6)],
        );
        assert.equal(
          (await q("SELECT count(*)::int n FROM notifications WHERE user_id=$1", [id(6)])).rows[0]
            .n,
          0,
        );
        for (const fn of [
          "private.notification_copy()",
          "private.notify_schedule_published()",
          "public.process_schedule_reminders()",
        ])
          assert.equal(
            (await q("SELECT has_function_privilege('authenticated',$1,'EXECUTE') allowed", [fn]))
              .rows[0].allowed,
            false,
          );
      },
    );
    await t.test(
      "exclusão de servo: somente admin, confirmação, histórico e bloqueio de acesso",
      async () => {
        await session("postgres");
        await q(
          "INSERT INTO auth.users(id,email) VALUES ($1,'exclusao@example.invalid'),($2,'pastor@example.invalid')",
          [id(7), id(8)],
        );
        await q("UPDATE profiles SET role='pastor' WHERE id=$1", [id(8)]);
        await q("INSERT INTO user_ministries(user_id,ministry_id) VALUES($1,$2)", [id(7), mid]);
        const future = id(501),
          past = id(502);
        await q(
          "INSERT INTO events(id,name,date,start_time,end_time) VALUES($1,'Futuro','2099-12-01','19:00','21:00'),($2,'Histórico','2098-01-01','19:00','21:00')",
          [future, past],
        );
        await q(
          "INSERT INTO schedules(user_id,ministry_id,event_id,status) VALUES($1,$2,$3,'scheduled'),($1,$2,$4,'scheduled')",
          [id(7), mid, future, past],
        );
        await q("UPDATE schedules SET status='completed' WHERE user_id=$1 AND event_id=$2", [
          id(7),
          past,
        ]);
        await q("UPDATE events SET date='2000-01-01' WHERE id=$1", [past]);
        await session("anon");
        await assert.rejects(
          q("SELECT delete_servo($1,$2)", [id(7), "EXCLUIR"]),
          /permission denied/,
        );
        for (const uid of [id(2), id(8), id(3)]) {
          await session("authenticated", uid);
          await assert.rejects(
            q("SELECT delete_servo($1,$2)", [id(7), "EXCLUIR"]),
            /Somente o administrador/,
          );
        }
        await session("authenticated", id(1));
        await assert.rejects(q("SELECT delete_servo($1,$2)", [id(7), ""]), /Confirme/);
        await assert.rejects(q("SELECT delete_servo($1,$2)", [id(1), "EXCLUIR"]), /Confirme/);
        await assert.rejects(q("SELECT delete_servo($1,$2)", [id(2), "EXCLUIR"]), /apenas servos/);
        await q("SELECT delete_servo($1,$2)", [id(7), "EXCLUIR"]);
        const removed = (await q("SELECT * FROM list_people() WHERE id=$1", [id(7)])).rows[0];
        assert.equal(removed.active, false);
        assert.ok(removed.deleted_at);
        await assert.rejects(
          q("UPDATE profiles SET active=true WHERE id=$1", [id(7)]),
          /não pode ser reativado/,
        );
        await session("postgres");
        assert.equal(
          (await q("SELECT count(*)::int n FROM user_ministries WHERE user_id=$1", [id(7)])).rows[0]
            .n,
          0,
        );
        assert.equal(
          (
            await q("SELECT status FROM schedules WHERE user_id=$1 AND event_id=$2", [
              id(7),
              future,
            ])
          ).rows[0].status,
          "cancelled",
        );
        assert.equal(
          (await q("SELECT status FROM schedules WHERE user_id=$1 AND event_id=$2", [id(7), past]))
            .rows[0].status,
          "completed",
        );
        assert.equal(
          (await q("SELECT count(*)::int n FROM auth.users WHERE id=$1", [id(7)])).rows[0].n,
          1,
        );
        await session("authenticated", id(7));
        await assert.rejects(
          q("SELECT save_schedule($1,$2,$3,true,1)", [future, mid, [id(7)]]),
          /conta ativa/,
        );
      },
    );
    await t.test(
      "cadastro automático não concede cargo e vínculos não podem ser reescritos",
      async () => {
        await session("postgres");
        await q("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,$2,$3)", [
          id(700),
          "novo@example.invalid",
          JSON.stringify({ full_name: "Novo Servo", role: "admin", ministry_ids: [mid, other] }),
        ]);
        assert.equal(
          (await q("SELECT role FROM profiles WHERE id=$1", [id(700)])).rows[0].role,
          "servo",
        );
        assert.equal(
          (await q("SELECT * FROM user_ministries WHERE user_id=$1", [id(700)])).rows.length,
          2,
        );
        await session("authenticated", id(700));
        await assert.rejects(
          q("SELECT complete_my_ministries($1)", [[other]]),
          /já está cadastrado/,
        );
        await assert.rejects(
          q("UPDATE profiles SET role='lider' WHERE id=$1", [id(700)]),
          /permissão/,
        );
        await assert.rejects(
          q("INSERT INTO ministry_leaders(user_id,ministry_id) VALUES ($1,$2)", [id(700), mid]),
          /permission denied/,
        );
        await session("postgres");
        await q("INSERT INTO auth.users(id,email) VALUES ($1,$2)", [
          id(701),
          "legado@example.invalid",
        ]);
        await session("authenticated", id(701));
        await assert.rejects(q("SELECT complete_my_ministries($1)", [[]]), /um ou dois/);
        await q("SELECT complete_my_ministries($1)", [[other]]);
        assert.equal(
          (await q("SELECT * FROM user_ministries WHERE user_id=$1", [id(701)])).rows.length,
          1,
        );
      },
    );
    await t.test("pastor atribui liderança mas não promove pastor nem altera admin", async () => {
      await session("postgres");
      await q("UPDATE profiles SET role='pastor' WHERE id=$1", [id(701)]);
      await session("authenticated", id(701));
      await q("SELECT set_member_access($1,'lider',$2,true)", [id(700), [mid]]);
      await assert.rejects(
        q("UPDATE profiles SET role='pastor' WHERE id=$1", [id(700)]),
        /permissão/,
      );
      await q("UPDATE profiles SET role='servo' WHERE id=$1", [id(1)]); // RLS hides admin row.
      await session("postgres");
      assert.equal(
        (await q("SELECT role FROM profiles WHERE id=$1", [id(1)])).rows[0].role,
        "admin",
      );
      await session("authenticated", id(1));
      await assert.rejects(q("UPDATE profiles SET role='admin' WHERE id=$1", [id(700)]), /única/);
    });
    await t.test("acessos: atomicidade, liderança real, limites e privacidade", async () => {
      await session("authenticated", id(3));
      await assert.rejects(
        q("SELECT set_member_access($1,'lider',$2,true)", [id(700), [mid]]),
        /Somente Pastor/,
      );
      await session("authenticated", id(701));
      await assert.rejects(
        q("SELECT set_member_access($1,'pastor',$2,true)", [id(700), []]),
        /Somente Admin/,
      );
      await assert.rejects(
        q("SELECT set_member_access($1,'lider',$2,true)", [id(700), [id(9999)]]),
        /ativos/,
      );
      await assert.rejects(
        q("SELECT set_member_access($1,'lider',$2,true)", [id(700), []]),
        /um ou dois/,
      );
      assert.equal(
        (await q("SELECT ministry_id FROM ministry_leaders WHERE user_id=$1", [id(700)])).rows[0]
          .ministry_id,
        mid,
      );
      await q("SELECT set_member_access($1,'servo',$2,true)", [id(700), []]);
      assert.equal(
        (await q("SELECT * FROM ministry_leaders WHERE user_id=$1", [id(700)])).rows.length,
        0,
      );
      assert.equal(
        (await q("SELECT * FROM user_ministries WHERE user_id=$1", [id(700)])).rows.length,
        2,
      );
      await session("authenticated", id(700));
      await assert.rejects(
        q("SELECT save_schedule($1,$2,$3,true,1)", [eid, mid, [id(3)]]),
        /Sem permissão/,
      );
      await session("authenticated", id(1));
      await q("SELECT set_member_access($1,'pastor',$2,true)", [id(700), []]);
      await assert.rejects(
        q("SELECT set_member_access($1,'servo',$2,true)", [id(1), []]),
        /protegida/,
      );
      await session("postgres");
      await q("UPDATE profiles SET role='servo' WHERE id=$1", [id(700)]);
    });
    await t.test(
      "troca nova exige aceite e mantém original até confirmação; valida conflito e autoria",
      async () => {
        await session("postgres");
        const ev = id(710);
        await q(
          "INSERT INTO events(id,name,date,start_time,end_time) VALUES ($1,'Troca nova','2099-12-03','19:00','21:00')",
          [ev],
        );
        await session("authenticated", id(1));
        await q("SELECT save_schedule($1,$2,$3,true,1)", [ev, mid, [id(700)]]);
        await session("postgres");
        const sid = (await q("SELECT id FROM schedules WHERE event_id=$1", [ev])).rows[0].id;
        await session("authenticated", id(700));
        assert.equal(
          (await q("SELECT * FROM substitution_options($1,false) WHERE user_id=$2", [sid, id(4)]))
            .rows.length,
          0,
        );
        assert.equal(
          (await q("SELECT * FROM substitution_options($1,true) WHERE user_id=$2", [sid, id(4)]))
            .rows.length,
          1,
        );
        const rid = (
          await q("SELECT request_substitution_v2($1,$2,true,'Combinado') rid", [sid, id(4)])
        ).rows[0].rid;
        assert.equal(
          (await q("SELECT status FROM schedules WHERE id=$1", [sid])).rows[0].status,
          "scheduled",
        );
        await assert.rejects(q("SELECT respond_substitution_v2($1,true)", [rid]), /não encontrado/);
        await session("authenticated", id(4));
        await q("SELECT respond_substitution_v2($1,true)", [rid]);
        await session("postgres");
        assert.equal(
          (await q("SELECT status FROM schedules WHERE id=$1", [sid])).rows[0].status,
          "replaced",
        );
        assert.equal(
          (await q("SELECT user_id FROM schedules WHERE event_id=$1 AND status='scheduled'", [ev]))
            .rows[0].user_id,
          id(4),
        );
        await session("authenticated", id(4));
        await assert.rejects(q("SELECT respond_substitution_v2($1,true)", [rid]), /já respondido/);
        await session("postgres");
      },
    );
    await t.test("bucket privado limita tipo e fotos de outros ministérios", async () => {
      await session("postgres");
      await q("INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars',$1)", [
        `${id(3)}/foto.png`,
      ]);
      const bucket = (await q("SELECT * FROM storage.buckets WHERE id='avatars'")).rows[0];
      assert.equal(bucket.public, false);
      assert.deepEqual(bucket.allowed_mime_types, ["image/jpeg", "image/png", "image/webp"]);
      await session("authenticated", id(5));
      assert.equal((await q("SELECT * FROM storage.objects")).rows.length, 0);
      await session("authenticated", id(3));
      assert.equal((await q("SELECT * FROM storage.objects")).rows.length, 1);
    });
  } finally {
    await db.close();
  }
});
