-- ETAPA 2: somente após publicar o frontend que usa list_people.
BEGIN;
REVOKE SELECT (email,phone) ON public.profiles FROM authenticated;
COMMIT;
