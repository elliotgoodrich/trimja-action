[![Build](https://github.com/elliotgoodrich/trimja-action/actions/workflows/ci.yaml/badge.svg)](https://github.com/elliotgoodrich/trimja-action/actions/workflows/ci.yaml)

# Trimja Github Action

The Trimja GitHub Action will download and run
[trimja](https://github.com/elliotgoodrich/trimja) to cut the work needed to do
in a [Ninja](https://ninja-build.org/)-based project to only on only the
dependent build commands affected by files changed in the the latest commit.

This can **greatly speed up the time taken for your pull requests to pass CI**.

## Instructions

To use the Trimja GitHub Action in your workflow, add the following step to your
YAML configuration:

```yaml
- uses: elliotgoodrich/trimja-action@release # live-at-head release
  with:
    # Version string for trimja.
    # Default: '0.4.0'
    version: ''

    # The path to the ninja build file.
    # Default: 'build.ninja'
    path: ''

    # Add additional string to include in the cache that describes your build
    # configuration e.g. "Debug32", "arm-64", or "gcc/release/64".  This
    # cannot be more 100 characters.
    # Default: ''
    build-configuration: ''

    # A list of additional files or build outputs to mark as affected.
    # Default: ''
    affected: ''

    # Whether to pass `--explain` when running trimja, which will print out the
    # reason why it is including each build command.  Useful for debugging issues.
    # Default: 'false'
    explain: ''
```

## Example

Below is an example of how `trimja-action` can be used as part of a CMake build.

```yaml
jobs:
  build:
    steps:
    # Step 1: Checkout the repository
    - uses: actions/checkout@v4

    # Step 2: Setup ninja
    - uses: seanmiddleditch/gha-setup-ninja@v5

    # Step 3: Configure the project using CMake
    - run: >
        cmake -B output
          -DCMAKE_CXX_COMPILER=clang
          -DCMAKE_C_COMPILER=clang
          -DCMAKE_BUILD_TYPE=Debug
          -G Ninja

    # Step 4: Setup and run trimja
    - uses: elliotgoodrich/trimja-action@release # live-at-head release
      with:
        path: output/build.ninja
        build-configuration: Debug-clang
        affected: |
          output/extra-tests
        explain: true

    # Step 5: Build only those things affected by the latest commits
    - run: cmake --build output --config Debug

    # Step 6: Run any affected tests with CTest
    - run: ctest --build-config Debug --output-on-failure --test-dir output

    # Step 7: Run legacy tests that haven't been migrated to CTest
    - run: ./output/extra-tests --run-all-tests
```

## FAQ

### Why are steps failing after running ninja?

If you have steps in your continuous integration pipeline that are failing after
running ninja, it may be because they depend on an output that is no longer
being generated by ninja.

For example, if you expect an executable called `myapp` to be built after
running `ninja myapp`, you can encounter issues if `trimja` decides not to build
`myapp` because no files needed to build it have changed.

To address this, you can consider the following options:

  1. Put all of your logic into your ninja build file.
  2. Check if the required files exist and conditionally skip steps.
  3. Pass `myapp` to the `affected` input of `trimja-action` to ensure it is
     always included in the trimmed ninja build file.

### Why does `trimja-action` include more commands than expected?

To understand why `trimja-action` includes each build command, you can set the
`explain` input to `true`. This will provide a log that lists all affected files
and the inputs to `trimja`.

However, there are a few situations where more commands may be included:

  1. The Action cache has expired. Caches of the `.ninja_deps` and `.ninja_log`
     files are only kept for 7 days without use. If you infrequently push changes
     to a repository, you may not see benefits if at least a week has passed.
  2. The cache is older than expected. If the build fails on your default branch,
     a cache will not be uploaded. So when opening a pull request from the HEAD of
     your default branch, the `trimja` cache may be for an older commit.
  3. The `build-configuration` was not supplied or is not unique across different
     build configurations. In this case, the wrong cache is being used, and
     `trimja` includes the build commands.
  4. There may be a bug. If you suspect an issue, please open an issue on the
     [trimja-action repository](https://github.com/elliotgoodrich/trimja-action/issues/new).

### Why does `trimja-action` include fewer commands than expected?

There are a few situations where `trimja` may exclude more commands than expected:

  1. Your ninja build file may not correctly capture all dependencies.
  2. When pushing commits to a pull request, `trimja-action` compares the changes
     to the last successful build on that pull request. If a change does not
     affect any dependencies, no work is expected to be done.
  3. There may be a bug. If you suspect an issue, please open an issue on the
     [trimja-action repository](https://github.com/elliotgoodrich/trimja-action/issues/new).

## Implementation Overview

  1. Checkout the latest commit
  2. Generate the ninja build file
  3. Lookup the latest `TRIMJA-[OS]-*` entry in Github cache
  4. If not found, then skip to 9
  5. Install the cache to the ninja output directory, look at the SHA in the cache name
  6. `git fetch origin HASH` to get the cache commit
  7. Get the list of files changed between these commits
     `git diff HASH..HEAD --name-only`
  8. Run trimja
  9. Run ninja
  10. Upload the ninja files as `TRIMJA-[OS]-{HEAD}`
