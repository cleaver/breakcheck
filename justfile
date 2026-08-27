# Directory used for locally packed public packages. It is cleaned before every pack.
local-pack-dir := justfile_directory() + "/.local-breakcheck-packages"

# Set the release version without creating a commit, tag, or npm release.
bump-version version:
    #!/usr/bin/env bash
    set -euo pipefail

    release_version="{{version}}"
    if [[ ! "$release_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
        printf 'Invalid release version: %s\nUse a semantic version such as 0.2.3.\n' "$release_version"
        exit 1
    fi

    npm pkg set "version=$release_version"
    npm pkg set "version=$release_version" --workspace=@cleaver/breakcheck-core
    npm pkg set "version=$release_version" --workspace=@cleaver/breakcheck
    npm pkg set "dependencies.@cleaver/breakcheck-core=^$release_version" --workspace=@cleaver/breakcheck
    npm pkg set "dependencies.@cleaver/breakcheck-core=^$release_version" --workspace=breakcheck-server
    npm install --package-lock-only --ignore-scripts

    node -e 'for (const file of ["package.json", "packages/core/package.json", "packages/cli/package.json", "packages/server/package.json"]) { const packageData = require(`./${file}`); console.log(`${file}: ${packageData.name}@${packageData.version}`); }'
    printf 'Core dependency ranges now target ^%s.\n' "$release_version"

# Run all checks that are safe to perform before publishing a release.
prerelease:
    #!/usr/bin/env bash
    set -euo pipefail

    root_version="$(node -p "require('./package.json').version")"
    core_version="$(node -p "require('./packages/core/package.json').version")"
    cli_version="$(node -p "require('./packages/cli/package.json').version")"
    cli_core_dependency="$(node -p "require('./packages/cli/package.json').dependencies['@cleaver/breakcheck-core']")"
    server_version="$(node -p "require('./packages/server/package.json').version")"

    if [[ "$root_version" != "$core_version" || "$root_version" != "$cli_version" ]]; then
        printf 'Release versions are out of sync:\n  root: %s\n  core: %s\n  cli:  %s\n' "$root_version" "$core_version" "$cli_version"
        exit 1
    fi

    case "$cli_core_dependency" in
        "$core_version"|"^$core_version")
            ;;
        *)
            printf 'CLI core dependency must target the current core release:\n  core version: %s\n  cli declares: %s\n  expected:     %s or ^%s\n' "$core_version" "$cli_core_dependency" "$core_version" "$core_version"
            exit 1
            ;;
    esac

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

# Build and pack both public packages for installation in a local consumer project.
local-pack:
    #!/usr/bin/env bash
    set -euo pipefail

    repo_dir="{{justfile_directory()}}"
    pack_dir="{{local-pack-dir}}"
    rm -rf -- "$pack_dir"
    mkdir -p -- "$pack_dir"
    cd "$repo_dir"
    npm run build
    (
        cd "$repo_dir/packages/core"
        npm pack --pack-destination "$pack_dir"
    )
    (
        cd "$repo_dir/packages/cli"
        npm pack --pack-destination "$pack_dir"
    )

# Install packages produced by local-pack into a consumer without changing its manifest or lockfile.
local-install project=invocation_directory():
    #!/usr/bin/env bash
    set -euo pipefail

    target_dir="$(cd "{{project}}" && pwd)"
    pack_dir="{{local-pack-dir}}"
    local_packages=(
        "$pack_dir"/cleaver-breakcheck-core-*.tgz
        "$pack_dir"/cleaver-breakcheck-[0-9]*.tgz
    )

    for local_package in "${local_packages[@]}"; do
        if [[ ! -f "$local_package" ]]; then
            printf 'Local package not found: %s\nRun `just local-pack` first.\n' "$local_package"
            exit 1
        fi
    done

    npm --prefix "$target_dir" install --no-save --package-lock=false --no-audit --no-fund "${local_packages[@]}"
    (
        cd "$target_dir"
        npx --no-install breakcheck --version
    )
