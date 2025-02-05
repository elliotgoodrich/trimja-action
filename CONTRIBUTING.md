# Contributing

## Requirements

The following are prerequsite to building trimja-action:
  * [NodeJS](https://nodejs.org/en/download) (version 20+)
  * [ninja](https://ninja-build.org/)

## Building

  1. `npm ci`
  2. `ninja`

## Submitting changes

Note that unlike many other GitHub Action repositories, the generated JavaScript
should not be committed along with the changes.  Once a change has landed on
`main`, the JavaScript will be generated and the total changes committed to the
`release` branch, where all releases are cut from.

## Creating a Release

  1. Create a release from the GitHub website
     * Select a new tag in the format of `vA.B.C`
     * Select the `release` branch as the target
     * Click "Generate release notes"
     * Keep the generated release name as `vA.B.C`
     * Click "Publish release"
  2. `git fetch origin`
  3. `git tag vA vA.B.C --force`
  4. `git push origin tag vA --force`
`