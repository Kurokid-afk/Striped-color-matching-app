import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceHtml = process.argv[2] || "app/index.html";
const previewOutput = process.argv[3] || "";
const html = await fs.readFile(sourceHtml, "utf8");
const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stripe-studio-copy-alias-"));
const testHtmlPath = path.join(testRoot, "copy_alias_test.html");

const injection = `
window.addEventListener('load', async () => {
  const checks = [];
  const check = (name, value, detail = '') => {
    checks.push({ name, passed: !!value, detail });
    if (!value) throw new Error(name + (detail ? ': ' + detail : ''));
  };

  try {
    colorLibrary = [
      { id: 'C001', type: 'solid', name: '海军蓝', hex: '#112233' },
      { id: 'C002', type: 'solid', name: '午夜蓝', hex: '#112233' },
      { id: 'C003', type: 'solid', name: '米白', hex: '#EEE9DE' }
    ];
    state.name = '尺寸与同色异名测试';
    state.orientation = 'horizontal';
    state.repeatCount = 2;
    state.laneSize = 1.5;
    state.roles = {
      A: { fillId: 'C001', color: '#112233', name: '海军蓝', locked: false },
      B: { fillId: 'C002', color: '#112233', name: '午夜蓝', locked: false },
      C: { fillId: 'C003', color: '#EEE9DE', name: '米白', locked: false }
    };
    state.stripes = [
      { lanes: 2, role: 'A', _sortId: 'test-a' },
      { lanes: 3, role: 'B', _sortId: 'test-b' },
      { lanes: 4, role: 'C', _sortId: 'test-c' }
    ];
    state.palette = ['C001', 'C002', 'C003'];

    check('same hex stays visually equal', fillVisualKey('C001') === fillVisualKey('C002'));
    check('same hex aliases have distinct identity', fillIdentityKey('C001') !== fillIdentityKey('C002'));
    check('alias badge reports both names', sameHexAliasLabel(findFillById('C001')) === '同色异名 2');

    const beforeRoles = state.stripes.map(stripe => stripe.role).join(',');
    collapseDuplicateUsedFillRoles();
    check('migration does not collapse same-hex aliases', state.stripes.map(stripe => stripe.role).join(',') === beforeRoles);

    const conflict = findUsedSolidColorConflict('A', resolveFillRef('C002'));
    check('exact resource still swaps instead of duplicating', conflict?.role === 'B');
    colorLibrary.push({ id: 'C004', type: 'solid', name: '深海蓝', hex: '#112233' });
    check('different alias is not treated as duplicate', !findUsedSolidColorConflict('A', resolveFillRef('C004')));

    const names = exportPatternColorNames(state.roles);
    check('export keeps exact alias names', names.includes('海军蓝') && names.includes('午夜蓝'), names.join('|'));
    const namedTemporary = exportPatternColorNames(
      { D: { color: '#445566', name: '深雾灰' } },
      { stripes: [{ lanes: 1, role: 'D' }] }
    );
    check('named temporary color exports its name', namedTemporary.join('|') === '深雾灰', namedTemporary.join('|'));
    const unnamedTemporary = exportPatternColorNames(
      { D: { color: '#445566', name: '#445566' } },
      { stripes: [{ lanes: 1, role: 'D' }] }
    );
    check('truly unnamed color falls back to hex', unnamedTemporary.join('|') === '#445566', unnamedTemporary.join('|'));

    const dimension = buildDimensionDisplayExportSvg();
    check('dimension export mode is selected', dimension.mode === 'dimensions');
    check('dimension export labels every repeated segment', dimension.segmentCount === 6, String(dimension.segmentCount));
    check('dimension export uses centimeters', dimension.svg.includes('0.3 cm') && dimension.svg.includes('0.45 cm') && dimension.svg.includes('0.6 cm'));
    check('dimension export contains project name', dimension.svg.includes('尺寸与同色异名测试'));
    check('dimension export is a complete image', !dimension.svg.includes('overflow') && !dimension.svg.includes('scrollbar'));
    const dimensionDocument = new DOMParser().parseFromString(dimension.svg, 'image/svg+xml');
    const dimensionText = Array.from(dimensionDocument.querySelectorAll('text')).map(node => node.textContent).join('|');
    check('dimension export uses exact resource names', dimensionText.includes('海军蓝') && dimensionText.includes('午夜蓝'), dimensionText);
    check('dimension export does not show hex when names exist', !dimensionText.includes('#112233'), dimensionText);
    state.orientation = 'vertical';
    const verticalDimension = buildDimensionDisplayExportSvg();
    check('vertical dimension export keeps every segment', verticalDimension.segmentCount === dimension.segmentCount);
    check('vertical dimension export has horizontal brackets', verticalDimension.svg.includes('data-dimension-segment="6"'));
    state.orientation = 'horizontal';

    state.palette.push('C004');
    pendingRoleReplace = 'A';
    const aliasApplied = applyPaletteRefToPendingRole('C004');
    check('manual same-hex alias replaces without swapping another role', aliasApplied && state.roles.A.fillId === 'C004' && state.roles.B.fillId === 'C002');
    const aliasRoleCard = document.querySelector('#roles .role-item[data-role="A"]');
    const aliasCardTransforms = (aliasRoleCard?.getAnimations?.() || [])
      .flatMap(animation => animation.effect?.getKeyframes?.() || [])
      .map(frame => frame.transform)
      .filter(Boolean);
    check('same-hex alias replacement does not shake the role card', aliasCardTransforms.length === 0, aliasCardTransforms.join('|'));
    const exactSwapApplied = applyPaletteRefToPendingRole('C002');
    check('selecting an exact used resource swaps identities', exactSwapApplied && state.roles.A.fillId === 'C002' && state.roles.B.fillId === 'C004');

    const libraryCountBeforeName = colorLibrary.length;
    pendingNamedColorHex = '#112233';
    pendingNamedColorAction = { mode: 'add', paletteIndex: null };
    document.querySelector('#colorNameDialogInput').value = '陶瓷蓝';
    confirmNamedColorToPalette();
    const namedAlias = colorLibrary.find(item => item.name === '陶瓷蓝' && item.hex === '#112233');
    check('name dialog creates same-hex alias with a new id', !!namedAlias && colorLibrary.length === libraryCountBeforeName + 1);
    const countAfterAlias = colorLibrary.length;
    pendingNamedColorHex = '#112233';
    pendingNamedColorAction = { mode: 'add', paletteIndex: null };
    document.querySelector('#colorNameDialogInput').value = '陶瓷蓝';
    confirmNamedColorToPalette();
    check('exact name and hex does not duplicate', colorLibrary.length === countAfterAlias);

    const idRemap = new Map();
    const merged = mergeFixedAssetColors(colorLibrary, [
      { id: 'C900', type: 'solid', name: '海军蓝', hex: '#112233' },
      { id: 'C901', type: 'solid', name: '雾蓝', hex: '#112233' }
    ], idRemap);
    check('exact imported resource is merged', idRemap.get('C900') === 'C001');
    check('same hex with a new name is preserved', merged.some(item => item.id === 'C901' && item.name === '雾蓝'));

    setCopyImageMode('standard', { persist: false });
    const modeSwitchBefore = document.querySelector('#copyImageModeSwitch')?.getBoundingClientRect();
    void document.querySelector('#copyImageModeSwitch')?.offsetWidth;
    document.querySelector('#copyImageDimensionMode')?.click();
    check('copy switch updates without layout animation', document.querySelector('#copyImageDimensionMode')?.getAttribute('aria-pressed') === 'true');
    check('copy switch exposes dimension state', document.querySelector('#copyImageModeSwitch')?.dataset.mode === 'dimensions');
    check('copy button clearly names dimension output', document.querySelector('#copyCanvasImageBtn')?.textContent === '复制尺寸图');
    check('copy switch choice persists', localStorage.getItem(COPY_IMAGE_MODE_KEY) === 'dimensions');
    const slider = document.querySelector('.copy-image-mode-thumb');
    check('copy switch has a dedicated sliding thumb', !!slider);
    check('copy switch animates the thumb transform', getComputedStyle(slider).transitionProperty.split(',').map(value => value.trim()).includes('transform'));
    const thumbAnimations = (slider?.getAnimations?.() || []);
    check('clicking a mode starts one smooth slide', thumbAnimations.some(animation => Number(animation.effect?.getTiming?.().duration) >= 200));
    const modeSwitchRect = document.querySelector('#copyImageModeSwitch')?.getBoundingClientRect();
    const copyButtonRect = document.querySelector('#copyCanvasImageBtn')?.getBoundingClientRect();
    check('copy controls stay on one visual line', !!modeSwitchRect && !!copyButtonRect && Math.abs((modeSwitchRect.top + modeSwitchRect.height / 2) - (copyButtonRect.top + copyButtonRect.height / 2)) < 3);
    check('copy switch keeps its size while sliding', !!modeSwitchBefore && !!modeSwitchRect && Math.abs(modeSwitchBefore.width - modeSwitchRect.width) < 0.1 && Math.abs(modeSwitchBefore.height - modeSwitchRect.height) < 0.1);
    const switchTransforms = [
      ...(document.querySelector('#copyImageStandardMode')?.getAnimations?.() || []),
      ...(document.querySelector('#copyImageDimensionMode')?.getAnimations?.() || [])
    ].flatMap(animation => animation.effect?.getKeyframes?.() || [])
      .map(frame => frame.transform)
      .filter(Boolean);
    check('copy switch transition has no bounce transform', switchTransforms.length === 0, switchTransforms.join('|'));
    [slider, document.querySelector('#copyImageStandardMode'), document.querySelector('#copyImageDimensionMode')]
      .flatMap(element => element?.getAnimations?.() || [])
      .forEach(animation => animation.finish());
    const dimensionThumbColor = getComputedStyle(slider).backgroundColor;
    const dimensionLabelColor = getComputedStyle(document.querySelector('#copyImageDimensionMode')).color;
    check('dimension selection uses readable white text', dimensionLabelColor === 'rgb(255, 255, 255)', dimensionLabelColor);
    check('inactive standard label remains dark and readable', getComputedStyle(document.querySelector('#copyImageStandardMode')).color !== 'rgb(255, 255, 255)');
    document.querySelector('#copyImageStandardMode')?.click();
    [slider, document.querySelector('#copyImageStandardMode'), document.querySelector('#copyImageDimensionMode')]
      .flatMap(element => element?.getAnimations?.() || [])
      .forEach(animation => animation.finish());
    const standardThumbColor = getComputedStyle(slider).backgroundColor;
    check('standard selection uses readable white text', getComputedStyle(document.querySelector('#copyImageStandardMode')).color === 'rgb(255, 255, 255)');
    check('two modes use different slider colors', standardThumbColor !== dimensionThumbColor, standardThumbColor + '|' + dimensionThumbColor);
    setCopyImageMode('dimensions', { persist: true });
    const dimensionBlob = await svgExportToPngBlob(dimension.svg, dimension.width, dimension.height, 1);
    check('dimension svg rasterizes to png', dimensionBlob.type === 'image/png' && dimensionBlob.size > 10000, String(dimensionBlob.size));
    let dimensionPngBase64 = '';
    if (${JSON.stringify(!!previewOutput)}) {
      const bytes = new Uint8Array(await dimensionBlob.arrayBuffer());
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      dimensionPngBase64 = btoa(binary);
    }

    document.body.textContent = '__CODEX_COPY_ALIAS_RESULT__' + JSON.stringify({
      ok: true,
      checks,
      dimensionPngBase64,
      dimension: {
        width: dimension.width,
        height: dimension.height,
        segmentCount: dimension.segmentCount
      }
    });
  } catch (error) {
    document.body.textContent = '__CODEX_COPY_ALIAS_RESULT__' + JSON.stringify({
      ok: false,
      checks,
      message: error && error.stack ? error.stack : String(error)
    });
  }
});
`;

const closurePattern = /\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if (!closurePattern.test(html)) throw new Error("Could not locate app closure");

const testHtml = html.replace(
  closurePattern,
  `${injection}\n})();\n\n</script>\n</body>`,
);
await fs.writeFile(testHtmlPath, testHtml, "utf8");

const electron = path.resolve("node_modules/electron/dist/electron.exe");
const electronRunner = path.resolve("work/electron_dump_dom.cjs");

try {
  const { stdout, stderr } = await execFileAsync(electron, [
    electronRunner,
    testHtmlPath,
    "__CODEX_COPY_ALIAS_RESULT__",
    "20000",
  ], { maxBuffer: 10 * 1024 * 1024, windowsHide: true });

  const marker = "__CODEX_COPY_ALIAS_RESULT__";
  const start = stdout.lastIndexOf(marker);
  if (start < 0) throw new Error(`Result marker missing: ${stderr.slice(0, 1000)}`);

  const tail = stdout.slice(start + marker.length);
  const end = tail.indexOf("</body>");
  if (end < 0) throw new Error("Result terminator missing");

  const result = JSON.parse(tail.slice(0, end).trim());
  if (!result.ok) throw new Error(result.message || "Copy/alias regression failed");
  if (previewOutput && result.dimensionPngBase64) {
    await fs.writeFile(previewOutput, Buffer.from(result.dimensionPngBase64, "base64"));
  }
  delete result.dimensionPngBase64;
  console.log(JSON.stringify(result, null, 2));
} finally {
  await fs.rm(testRoot, { recursive: true, force: true });
}
