# Snippets

Adapt names to the repo. `<reg>` is the lowercase registry path
(`ghcr.io/<org>/<repo>`), `<ns>` a label namespace the project owns, and
`BACKEND_URL` whichever public URL the web build inlines.

## Change map rows (bash `case`, inside the per-file loop)

```bash
case "$file" in
    # Build inputs the Dockerfiles COPY come first, before any blanket skip.
    scripts/lib/build-feature-flags.cjs)
        mark_all_web ;;
    # Backend code is pushed by the ship on its own.
    apps/api/backend/*|.github/*|scripts/*|*.md)
        continue ;;
    # .dockerignore drops these from every build context.
    */__tests__/*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx)
        continue ;;
    # Content only the backend renders. Guarded by a test.
    packages/ui/src/email/copy/*/billing-*.json|packages/ui/src/email/templates/billing-*.ts)
        continue ;;
    packages/ui/*)
        mark_all_web ;;
    apps/web/*)
        BUILD_WEB=true ;;
esac
```

## Fixture and guard tests (node:test)

```js
function detect(files) {
  const dir = mkdtempSync(join(tmpdir(), 'detect-'));
  writeFileSync(join(dir, '.last-deploy-sha'), 'abc123');
  const out = execFileSync('bash', [detectScript], {
    cwd: dir,
    env: { ...process.env, CHANGED_FILES_OVERRIDE: files.join('\n') },
    encoding: 'utf8',
  }).trim();
  return out ? out.split(/\s+/) : [];
}

test('backend-only email copy selects nothing', () => {
  assert.deepEqual(detect(['packages/ui/src/email/copy/en/billing-invoices.json']), []);
});

// The skip is only safe while no web app renders that content.
test('web apps render only auth emails', () => {
  let hits = '';
  try {
    hits = execFileSync('grep', ['-rnoE', '--include=*.ts', '--include=*.tsx',
      '--exclude-dir=__tests__', '--exclude-dir=node_modules',
      'renderEmail\\(\\s*[^,)]+', 'apps/web/src'], { cwd: repoRoot, encoding: 'utf8' });
  } catch (err) {
    if (err.status !== 1) throw err;
  }
  const other = hits.split('\n').filter((l) => l && !/renderEmail\(\s*['"]auth\./.test(l));
  assert.deepEqual(other, [], 'Widen the email row in the change map.');
});
```

Replay real history through both versions:

```bash
range="<last-deployed-sha>..origin/main"
echo "before: $(CHANGED_FILES_OVERRIDE="$(git diff --name-only $range)" bash <(git show HEAD:scripts/detect-changed-services.sh))"
echo "after:  $(CHANGED_FILES_OVERRIDE="$(git diff --name-only $range)" bash scripts/detect-changed-services.sh)"
```

## CI workflow steps

```yaml
      - name: Resolve registry
        run: echo "REGISTRY=ghcr.io/$(echo '${{ github.repository }}' | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_ENV"

      - name: Plan
        id: plan
        env:
          CHANGED: ${{ matrix.changed }}
          FORCED: ${{ inputs.force_build }}
        run: |
          if [ "$CHANGED" = "true" ] || [ "$FORCED" = "true" ]; then echo "action=build" >> "$GITHUB_OUTPUT"
          elif docker manifest inspect "$REGISTRY/${{ matrix.service }}:latest" > /dev/null 2>&1; then echo "action=retag" >> "$GITHUB_OUTPUT"
          else echo "action=build" >> "$GITHUB_OUTPUT"; fi

      - name: Retag unchanged
        if: steps.plan.outputs.action == 'retag'
        run: docker buildx imagetools create --tag "$REGISTRY/${{ matrix.service }}:${{ github.sha }}" "$REGISTRY/${{ matrix.service }}:latest"

      - name: Validate build config
        if: steps.plan.outputs.action == 'build'
        env:
          BACKEND_URL: ${{ matrix.backend_url }}
        run: |
          case "$BACKEND_URL" in
            https://*.retired-host.example*) echo "::error::backend URL still names the retired host: '$BACKEND_URL'"; exit 1 ;;
            https://?*) ;;
            *) echo "::error::backend URL variable is missing or malformed: '$BACKEND_URL'"; exit 1 ;;
          esac

      - name: Free runner disk
        if: steps.plan.outputs.action == 'build'
        run: |
          sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /opt/hostedtoolcache/CodeQL /usr/local/share/boost
          df -h /

      - uses: actions/checkout@v4
        if: steps.plan.outputs.action == 'build'
      - uses: docker/setup-buildx-action@v3
        if: steps.plan.outputs.action == 'build'

      - uses: docker/build-push-action@v6
        if: steps.plan.outputs.action == 'build'
        with:
          context: .
          file: ${{ matrix.dockerfile }}
          push: true
          provenance: false
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ matrix.service }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ matrix.service }}:buildcache,mode=max
          labels: |
            <ns>.backend-url=${{ matrix.backend_url }}
          tags: |
            ${{ env.REGISTRY }}/${{ matrix.service }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ matrix.service }}:latest
          build-args: |
            # one line per entry in the compose build.args block
```

Start a forced build with the long flag form, in its own command:

```bash
gh workflow run build-images.yml --ref main --field force_build=true
```

## Deploy script: flags

```bash
PULL_MODE=false
PREFER_PULL=false
# in the argument loop
        --pull)        PULL_MODE=true; shift ;;
        --prefer-pull) PULL_MODE=true; PREFER_PULL=true; shift ;;
```

## Deploy script: registry precheck with fallback

```bash
if [ "$PULL_MODE" = true ]; then
    _IMAGE_TAG_GIVEN="${IMAGE_TAG:-}"
    export IMAGE_TAG="${IMAGE_TAG:-$GIT_SHA}"
    export IMAGE_REGISTRY="${IMAGE_REGISTRY:-<reg>}"
    for _svc in "${SERVICES_TO_DEPLOY[@]}"; do
        if ! docker manifest inspect "$IMAGE_REGISTRY/$_svc:$IMAGE_TAG" > /dev/null 2>&1; then
            if [ "$PREFER_PULL" = true ]; then
                warn "No $IMAGE_REGISTRY/$_svc:$IMAGE_TAG in the registry. Building on the server instead."
                PULL_MODE=false
                if [ -n "$_IMAGE_TAG_GIVEN" ]; then export IMAGE_TAG="$_IMAGE_TAG_GIVEN"; else unset IMAGE_TAG; fi
                break
            fi
            error "Cannot read $IMAGE_REGISTRY/$_svc:$IMAGE_TAG from the registry."
            exit 1
        fi
    done
fi
```

## Deploy script: label check after the pull

```bash
pulled_images_match_env() {
    local svc want got
    for svc in "${SERVICES_TO_DEPLOY[@]}"; do
        case "$svc" in
            web) want="${NEXT_PUBLIC_BACKEND_URL:-}" ;;
            *) continue ;;
        esac
        got="$(docker inspect --format '{{ index .Config.Labels "<ns>.backend-url" }}' "$IMAGE_REGISTRY/$svc:$IMAGE_TAG" 2>/dev/null || true)"
        if [ -z "$want" ] || [ "$got" != "$want" ]; then
            warn "$svc image $IMAGE_TAG was built for '${got:-unlabelled}', this server uses '${want:-unset}'."
            return 1
        fi
    done
    return 0
}

set +e
if [ "$PULL_MODE" = true ]; then
    docker compose -f "$COMPOSE_FILE" pull ${SERVICES_TO_DEPLOY[*]}
    BUILD_EXIT=$?
    if [ "$BUILD_EXIT" -eq 0 ] && ! pulled_images_match_env; then
        if [ "$PREFER_PULL" = true ]; then
            warn "Not using the CI images. Building on the server instead."
            PULL_MODE=false
            if [ -n "$_IMAGE_TAG_GIVEN" ]; then export IMAGE_TAG="$_IMAGE_TAG_GIVEN"; else unset IMAGE_TAG; fi
        else
            BUILD_EXIT=1
        fi
    fi
fi
if [ "$PULL_MODE" = false ]; then
    docker compose -f "$COMPOSE_FILE" build ${SERVICES_TO_DEPLOY[*]}
    BUILD_EXIT=$?
fi
set -e
```

Stub test for the function:

```bash
sed -n '/^pulled_images_match_env() {/,/^}/p' scripts/deploy-app.sh > /tmp/fn.sh
bash -c 'warn(){ echo "WARN $1"; }; source /tmp/fn.sh
IMAGE_REGISTRY=r IMAGE_TAG=t NEXT_PUBLIC_BACKEND_URL=https://api.example.com SERVICES_TO_DEPLOY=(web)
docker(){ echo "$LABEL"; }
LABEL=https://api.example.com; pulled_images_match_env; echo "match rc=$?"
LABEL=https://old.example.com; pulled_images_match_env; echo "mismatch rc=$?"
LABEL=""; pulled_images_match_env; echo "unlabelled rc=$?"'
```

Expected: `match rc=0`, `mismatch rc=1`, `unlabelled rc=1`.

## Deploy script: login for one ship (laptop half)

```bash
REGISTRY_LOGIN=false
case " $* " in
    *" --pull "*|*" --prefer-pull "*)
        if command -v gh > /dev/null 2>&1 && _gh_user="$(gh api user -q .login 2>/dev/null)" && [ -n "$_gh_user" ]; then
            if gh auth token 2>/dev/null | ssh "$DEPLOY_SERVER" "docker login ghcr.io -u $_gh_user --password-stdin" > /dev/null 2>&1; then
                REGISTRY_LOGIN=true
            else
                echo "[WARNING] Could not log the server in to ghcr.io (does the gh token have read:packages?)"
            fi
        fi
        ;;
esac

set +e
ssh -t "$DEPLOY_SERVER" "cd $DEPLOY_DIR && bash scripts/deploy-app.sh $*"
SSH_EXIT=$?
if [ "$REGISTRY_LOGIN" = true ]; then
    ssh "$DEPLOY_SERVER" "docker logout ghcr.io" > /dev/null 2>&1 || true
fi
exit $SSH_EXIT
```

## package.json

```json
"ship": "bash scripts/deploy-app.sh --smart --prefer-pull"
```

Keep a strict `ship:pull` when the repo already has one.
