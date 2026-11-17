# GitHub release policy

This policy applies to every update pushed to
`Skydeps1459/Modern-Warfare-4-TACZ-GunPack`.

## Bug-fix hotfixes

- Bug fixes are accumulated and verified locally first.
- A hotfix is published only after at least **six independent bug fixes** have
  been completed and verified.
- Multiple symptoms caused by one root cause count as one bug, not several.
- When the threshold is reached, increment only the final version component
  (for example `1.8.0-Release` to `1.8.1-Release`), rebuild the main pack, push
  the update, and create the GitHub Release.
- A change batch below the threshold stays local and is not uploaded to GitHub.
- The repository owner may explicitly authorize an earlier or different release.

## Release page bug list

- Every published hotfix Release must include a `Bug 修复` section.
- List each independent bug actually included in that build as one sentence:
  which gun or system, what the player could see going wrong, and what the
  result is after the fix. Do not describe root causes, internal channel names,
  enum values, or timestamps, and do not end lines with punctuation.
- Do not list unverified fixes, future work, or fixes that are not present in the
  attached zip.
- Use [`RELEASE_NOTES_TEMPLATE.md`](./RELEASE_NOTES_TEMPLATE.md) as the required
  release description template.
- After uploading the replacement or new archive, read the Release page back and
  confirm that its bug list and attached file version match.

## New guns

- Adding a new gun does not grant permission to push or publish it.
- By default, new-gun work remains local and must not update the GitHub
  repository, GitHub Pages, or Releases.
- Uploading and publishing a new gun requires an explicit instruction in the
  current request, even after integration and in-game verification are complete.

## Scope

- Only the main `Modern Warfare 4` pack participates in GitHub releases.
- The frozen Lite pack is excluded.
- There is no automatic GitHub Release workflow. Pushing code and publishing a
  version are deliberate, separately verified operations.

## Website updates

- `web/website-updates.json` is the source of truth for website update history.
- Every user-visible website change must add or update an entry in that file in
  the same commit.
- The repository-driven website history is shown on `website-updates.html`; a
  separate GitHub Release is optional and requires explicit authorization.
- Website updates must not appear in the gun-pack update cards or gun-pack
  changelog.
- Website update entries have no download action. An optional external action may
  link to GitHub Release notes only.

