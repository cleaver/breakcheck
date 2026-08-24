# Run all checks that are safe to perform before publishing a release.
prerelease:
    #!/usr/bin/env bash
    set -euo pipefail

    root_version="$(node -p "require('./package.json').version")"
    core_version="$(node -p "require('./packages/core/package.json').version")"
    cli_version="$(node -p "require('./packages/cli/package.json').version")"
    server_version="$(node -p "require('./packages/server/package.json').version")"

    if [[ "$root_version" != "$core_version" || "$root_version" != "$cli_version" ]]; then
        printf 'Release versions are out of sync:\n  root: %s\n  core: %s\n  cli:  %s\n' "$root_version" "$core_version" "$cli_version"
        exit 1
    fi

    if [[ -n "$(git status --porcelain)" ]]; then
        echo 'The working tree must be clean before a prerelease check.'
        git status --short
        exit 1
    fi

    printf 'Release version: %s\n' "$root_version"
    printf 'breakcheck-server remains at %s and is not part of this release.\n' "$server_version"
    npm whoami

    check_unpublished() {
        local package_name="$1"
        local result

        if result="$(npm view "${package_name}@${root_version}" version --json 2>&1)"; then
            printf 'Already published: %s@%s\n%s\n' "$package_name" "$root_version" "$result"
            exit 1
        fi

        if grep -Eq 'E404|No match found for version|404 Not Found' <<<"$result"; then
            printf 'Not published: %s@%s\n' "$package_name" "$root_version"
        else
            printf 'Could not determine whether %s@%s is published:\n%s\n' "$package_name" "$root_version" "$result"
            exit 1
        fi
    }

    check_unpublished '@cleaver/breakcheck-core'
    check_unpublished '@cleaver/breakcheck'

    npm ci
    npm run build
    npm test
    npm run test:coverage
    npm run test:cli-bin
    npm run test:integration
    npm run test:packaging
    npm audit
    npm pack --dry-run --workspace=@cleaver/breakcheck-core
    npm pack --dry-run --workspace=@cleaver/breakcheck

    printf '\nPrerelease checks passed for v%s. Nothing has been published.\n\n' "$root_version"
    printf 'Publish manually with:\n'
    printf '  npm publish --workspace=@cleaver/breakcheck-core --access public\n'
    printf '  npm view @cleaver/breakcheck-core version\n'
    printf '  npm publish --workspace=@cleaver/breakcheck --access public\n'
    printf '  npm view @cleaver/breakcheck version\n\n'
    printf 'Or run `just release` from an interactive terminal to run those publish commands.\n'

# Run the preflight and publish both public packages interactively.
release: prerelease
    #!/usr/bin/env bash
    set -euo pipefail

    release_version="$(node -p "require('./package.json').version")"
    echo "Publishing @cleaver/breakcheck-core@$release_version..."
    npm publish --workspace=@cleaver/breakcheck-core --access public
    npm view @cleaver/breakcheck-core version

    echo "Publishing @cleaver/breakcheck@$release_version..."
    npm publish --workspace=@cleaver/breakcheck --access public
    npm view @cleaver/breakcheck version

    printf '\nRelease v%s published. Verify it from a fresh consumer, then tag it with:\n' "$release_version"
    printf '  git tag v%s\n  git push origin v%s\n' "$release_version" "$release_version"
