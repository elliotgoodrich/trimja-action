# Trimja Github Action

Trimja Github Action is a [Github Action](https://docs.github.com/en/actions) to
download, setup, and run [trimja](https://github.com/elliotgoodrich/trimja)
against a [ninja](https://ninja-build.org/)-based project in order to reduce the
set of things to build to only those files affected by the latest git commits.

## Strategy

### On `push`/`pull_request`

  1. Checkout the latest commit
  2. Generate the ninja build file
  3. Lookup the latest `TRIMJA-*` entry in Github cache
  4. If not found, then skip to 9
  5. Install the cache to the ninja output directory, look at the SHA in the cache name
  6. `git fetch origin HASH` to get the cache commit
  7. Get the list of files changed between these commits
     `git diff HASH..HEAD --name-only`
  8. Run trimja
  9. Run ninja
  10. Upload the ninja files as `TRIMJA-{HEAD}`
