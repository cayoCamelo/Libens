<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Keep schedule filters and event expansion as local view state; database row policies remain authoritative for visibility.
- Keep avatars in private storage with expiring signed links; update profile references before deleting prior files.
- Delete events only through explicit confirmation and preserve foreign-key restrictions to protect linked schedules.
- Use the existing notifications table and scheduled reminder function; never create a parallel notification system.
