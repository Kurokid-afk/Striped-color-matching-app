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
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    renderAll();

    beginRoleReplace('A');
    const immediateSwapSwatch = document.querySelector('#paletteGrid .swatch[data-index="1"]');
    check('swap marker appears immediately when replacement starts', immediateSwapSwatch?.classList.contains('role-replace-swap'));
    check('replacement helper clearly explains swapping', /↔.*对调/.test(document.querySelector('#roleReplaceHelper')?.textContent || ''));
    cancelRoleReplace({ silent: true });

    const originalRoleAFillId = state.roles.A.fillId;
    delete state.roles.A.fillId;
    check('legacy role name and hex recover exact resource identity', roleFillRef(state.roles.A) === 'C001', String(roleFillRef(state.roles.A)));
    state.roles.A.fillId = originalRoleAFillId;

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

    const libraryBeforeDetachedEdit = deepClone(colorLibrary);
    const palettesBeforeDetachedEdit = deepClone(savedPalettes());
    const paletteBeforeDetachedEdit = deepClone(state.palette);
    const rolesBeforeDetachedEdit = deepClone(state.roles);
    const activePaletteBeforeDetachedEdit = state.activeSavedPaletteId;
    const paletteNameBeforeDetachedEdit = state.paletteName;

    writeSavedPalettes([
      { id: 'pal-one', name: '第一组', colors: ['C001'], savedAt: 1 },
      { id: 'pal-two', name: '第二组', colors: ['C001'], savedAt: 2 }
    ], { touchAssets: false, reason: 'copy-alias-test-setup' });
    state.activeSavedPaletteId = 'pal-one';
    state.paletteName = '第一组';
    state.palette = ['C001'];
    state.roles.A = { color: '#112233', name: '海军蓝', locked: false };
    renderLibraryTable();

    const groupedNameInput = document.querySelector('.library-resource-row[data-group-key="palette_0"][data-id="C001"] .lib-name-input');
    check('shared color row can be edited in its own palette group', !!groupedNameInput);
    groupedNameInput.value = '仅第一组海军蓝';
    groupedNameInput.dispatchEvent(new Event('change', { bubbles: true }));

    const palettesAfterDetachedEdit = savedPalettes();
    const detachedId = palettesAfterDetachedEdit[0]?.colors?.[0];
    check('editing one palette detaches the shared resource', detachedId && detachedId !== 'C001' && palettesAfterDetachedEdit[1]?.colors?.[0] === 'C001', String(detachedId));
    check('other palette keeps the original name', findFillById('C001')?.name === '海军蓝', String(findFillById('C001')?.name));
    check('edited palette receives only its new name', findFillById(detachedId)?.name === '仅第一组海军蓝', String(findFillById(detachedId)?.name));
    check('active role follows the detached resource', state.roles.A.fillId === detachedId, String(state.roles.A.fillId));

    colorLibrary = libraryBeforeDetachedEdit;
    writeSavedPalettes(palettesBeforeDetachedEdit, { touchAssets: false, reason: 'copy-alias-test-restore' });
    state.palette = paletteBeforeDetachedEdit;
    state.roles = rolesBeforeDetachedEdit;
    state.activeSavedPaletteId = activePaletteBeforeDetachedEdit;
    state.paletteName = paletteNameBeforeDetachedEdit;
    saveColorLibrary();
    renderAll();

    const libraryBeforeReplacementCleanup = deepClone(colorLibrary);
    const palettesBeforeReplacementCleanup = deepClone(savedPalettes());
    const paletteBeforeReplacementCleanup = deepClone(state.palette);
    const rolesBeforeReplacementCleanup = deepClone(state.roles);
    const stripesBeforeReplacementCleanup = deepClone(state.stripes);
    const activeBeforeReplacementCleanup = state.activeSavedPaletteId;
    const nameBeforeReplacementCleanup = state.paletteName;

    colorLibrary.push({ id: 'C700', type: 'solid', name: '待替换旧色', hex: '#765432' });
    writeSavedPalettes([
      { id: 'pal-cleanup', name: '清理测试', colors: ['C700'], savedAt: 1 }
    ], { touchAssets: false, reason: 'replacement-cleanup-test' });
    state.activeSavedPaletteId = 'pal-cleanup';
    state.paletteName = '清理测试';
    state.palette = ['C700'];
    state.roles = {
      A: { fillId: 'C700', color: '#765432', name: '待替换旧色', locked: false }
    };
    state.stripes = [{ lanes: 1, role: 'A', _sortId: 'cleanup-a' }];
    openColorNameDialog('#EEE9DE', { mode: 'replace', paletteIndex: 0 });
    check(
      'editing a different hex keeps the original color name',
      document.querySelector('#colorNameDialogInput').value === '待替换旧色',
      document.querySelector('#colorNameDialogInput').value
    );
    document.querySelector('#colorNameDialogInput').value = '米白';
    confirmNamedColorToPalette();
    check('replaced orphan color is removed from library', !findFillById('C700'));
    check('replaced orphan color does not fall into ungrouped', !buildLibraryGroups().find(group => group.key === 'ungrouped')?.items.some(item => item.id === 'C700'));
    check('active roles follow the replacement instead of retaining the old color number', state.roles.A.fillId === 'C003', String(state.roles.A.fillId));

    colorLibrary.push({ id: 'C701', type: 'solid', name: '共享旧色', hex: '#654321' });
    writeSavedPalettes([
      { id: 'pal-cleanup-shared-a', name: '共享甲', colors: ['C701'], savedAt: 1 },
      { id: 'pal-cleanup-shared-b', name: '共享乙', colors: ['C701'], savedAt: 2 }
    ], { touchAssets: false, reason: 'replacement-cleanup-shared-test' });
    state.activeSavedPaletteId = 'pal-cleanup-shared-a';
    state.paletteName = '共享甲';
    state.palette = ['C701'];
    openColorNameDialog('#EEE9DE', { mode: 'replace', paletteIndex: 0 });
    document.querySelector('#colorNameDialogInput').value = '米白';
    confirmNamedColorToPalette();
    check('replaced color still used by another palette is preserved', !!findFillById('C701'));
    check('shared old color remains grouped instead of becoming ungrouped', buildLibraryGroups().find(group => group.key === 'palette_1')?.items.some(item => item.id === 'C701'));

    colorLibrary.push({ id: 'C702', type: 'solid', name: '原色号', hex: '#102030' });
    writeSavedPalettes([
      { id: 'pal-update-in-place', name: '原位更新', colors: ['C702'], savedAt: 1 }
    ], { touchAssets: false, reason: 'replacement-in-place-test' });
    state.activeSavedPaletteId = 'pal-update-in-place';
    state.paletteName = '原位更新';
    state.palette = ['C702'];
    state.roles = {
      A: { fillId: 'C702', color: '#102030', name: '原色号', locked: false }
    };
    state.stripes = [{ lanes: 1, role: 'A', _sortId: 'in-place-a' }];
    const libraryCountBeforeInPlace = colorLibrary.length;
    openColorNameDialog('#A1B2C3', { mode: 'replace', paletteIndex: 0 });
    confirmNamedColorToPalette();
    check('new hex updates the original color number in place', state.palette[0] === 'C702' && findFillById('C702')?.hex === '#A1B2C3', JSON.stringify({palette:state.palette, resource:findFillById('C702')}));
    check('in-place color update does not create an extra library row', colorLibrary.length === libraryCountBeforeInPlace, String(colorLibrary.length));
    check('in-place updated color stays in its saved palette group', savedPalettes()[0]?.colors?.[0] === 'C702' && !buildLibraryGroups().find(group => group.key === 'ungrouped')?.items.some(item => item.id === 'C702'));

    const sampled = addHexToPaletteAsLibraryResource('#B4C5D6', {
      nameHint: '图片取色',
      silent: true
    });
    check('image-picked color immediately joins the active saved palette', !!sampled && savedPalettes()[0]?.colors?.includes(sampled.id), JSON.stringify(savedPalettes()[0]?.colors));
    check('image-picked color never flashes into ungrouped', !!sampled && !buildLibraryGroups().find(group => group.key === 'ungrouped')?.items.some(item => item.id === sampled.id));

    colorLibrary = libraryBeforeReplacementCleanup;
    writeSavedPalettes(palettesBeforeReplacementCleanup, { touchAssets: false, reason: 'replacement-cleanup-test-restore' });
    state.palette = paletteBeforeReplacementCleanup;
    state.roles = rolesBeforeReplacementCleanup;
    state.stripes = stripesBeforeReplacementCleanup;
    state.activeSavedPaletteId = activeBeforeReplacementCleanup;
    state.paletteName = nameBeforeReplacementCleanup;
    saveColorLibrary();
    renderAll();

    const libraryBeforeMultiSort = deepClone(colorLibrary);
    const palettesBeforeMultiSort = deepClone(savedPalettes());
    const paletteBeforeMultiSort = deepClone(state.palette);
    const activeBeforeMultiSort = state.activeSavedPaletteId;
    const nameBeforeMultiSort = state.paletteName;

    await showColorLibrary();
    colorLibrary = [
      { id: 'C810', type: 'solid', name: '排序甲', hex: '#123456' },
      { id: 'C811', type: 'solid', name: '排序乙', hex: '#234567' },
      { id: 'C812', type: 'solid', name: '排序丙', hex: '#345678' },
      { id: 'C813', type: 'solid', name: '排序丁', hex: '#456789' },
      { id: 'C814', type: 'solid', name: '排序戊', hex: '#56789A' },
      { id: 'C815', type: 'solid', name: '排序己', hex: '#6789AB' },
      { id: 'C816', type: 'solid', name: '未分组甲', hex: '#789ABC' },
      { id: 'C817', type: 'solid', name: '未分组乙', hex: '#89ABCD' }
    ];
    writeSavedPalettes([
      {
        id: 'pal-multi-sort',
        name: '自由多选排序',
        colors: ['C810', 'C811', 'C812', 'C813', 'C814', 'C815'],
        savedAt: 1
      },
      {
        id: 'pal-multi-sort-other',
        name: '另一分组',
        colors: ['C810', 'C812'],
        savedAt: 2
      }
    ], { touchAssets: false, reason: 'multi-sort-test' });
    state.activeSavedPaletteId = 'pal-multi-sort';
    state.paletteName = '自由多选排序';
    state.palette = ['C810', 'C811', 'C812', 'C813', 'C814', 'C815'];
    selectedLibraryResourceIds.clear();
    selectedLibraryGroupKey = '';
    renderLibraryTable();
    syncLibraryStickyGroup();
    check('sticky group header stays hidden while first group title is fully visible', document.querySelector('#libraryStickyGroup')?.hidden === true);

    setLibraryResourceSelected('C811', 'palette_0', true);
    setLibraryResourceSelected('C814', 'palette_0', true);
    const selectedRows = [...document.querySelectorAll('.library-resource-row.batch-selected')]
      .map(row => row.dataset.id);
    check('library allows non-contiguous multi-selection', selectedRows.join('|') === 'C811|C814', JSON.stringify({selectedRows, selectedLibraryGroupKey, selectedIds:[...selectedLibraryResourceIds], groups:buildLibraryGroups().map(group => ({key:group.key, ids:group.items.map(item => item.id)}))}));
    check('library keeps drag grips visible beside selection boxes', getComputedStyle(document.querySelector('.library-batch-check')).display !== 'none' && getComputedStyle(document.querySelector('.library-drag-grip')).display !== 'none');
    check('multi-sort guidance appears only while colors are selected', !document.querySelector('#libraryBatchActions')?.hidden && document.querySelector('#libraryBatchSummary')?.textContent.includes('已选 2 个'));

    const dragGrip = document.querySelector('.library-drag-grip[data-group-key="palette_0"][data-id="C811"]');
    const dragTarget = document.querySelector('.library-resource-row[data-group-key="palette_0"][data-id="C815"]');
    const dragGripRect = dragGrip.getBoundingClientRect();
    const dragTargetRect = dragTarget.getBoundingClientRect();
    dragGrip.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerId: 91,
      clientX: dragGripRect.left + dragGripRect.width / 2,
      clientY: dragGripRect.top + dragGripRect.height / 2
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, button: 0, pointerId: 91,
      clientX: dragTargetRect.left + dragTargetRect.width / 2,
      clientY: dragTargetRect.bottom - 1
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, button: 0, pointerId: 91,
      clientX: dragTargetRect.left + dragTargetRect.width / 2,
      clientY: dragTargetRect.bottom - 1
    }));
    await wait(360);
    const draggedPaletteOrder = savedPalettes()[0]?.colors?.join('|') || '';
    check('dragging one selected handle moves every selected row together', draggedPaletteOrder === 'C810|C812|C813|C815|C811|C814', draggedPaletteOrder);
    check('multi-drag preserves selected colors relative order', draggedPaletteOrder.endsWith('C811|C814'), draggedPaletteOrder);

    const sortedPalette = {
      colors: ['C810', 'C811', 'C812', 'C813', 'C814', 'C815']
    };
    reorderSavedPaletteResourceSubset(
      sortedPalette,
      ['C810', 'C811', 'C812', 'C813', 'C814', 'C815'],
      ['C811', 'C814', 'C810', 'C812', 'C813', 'C815']
    );
    check('multi-sort moves separated colors as one stable block', sortedPalette.colors.join('|') === 'C811|C814|C810|C812|C813|C815', sortedPalette.colors.join('|'));

    reorderLibraryResourceSubset(
      ['C816', 'C817'],
      ['C817', 'C816']
    );
    check('ungrouped multi-sort changes only its own resource slots', colorLibrary.map(item => item.id).join('|') === 'C810|C811|C812|C813|C814|C815|C817|C816', colorLibrary.map(item => item.id).join('|'));

    setLibraryResourceSelected('C810', 'palette_1', true);
    check('starting selection in another group clears the previous group', selectedLibraryGroupKey === 'palette_1' && selectedLibraryResourceIds.size === 1 && selectedLibraryResourceIds.has('C810'));
    clearLibraryMultiSelection();
    check('clearing multi-selection restores idle controls', selectedLibraryResourceIds.size === 0 && selectedLibraryGroupKey === '' && document.querySelector('#libraryBatchActions')?.hidden === true);

    const crossGrip = document.querySelector('.library-drag-grip[data-group-key="palette_0"][data-id="C813"]');
    const crossHeader = document.querySelector('.library-group-row[data-group-key="palette_1"]');
    const crossGripRect = crossGrip.getBoundingClientRect();
    const crossHeaderRect = crossHeader.getBoundingClientRect();
    crossGrip.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerId: 92,
      clientX: crossGripRect.left + crossGripRect.width / 2,
      clientY: crossGripRect.top + crossGripRect.height / 2
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, button: 0, pointerId: 92,
      clientX: crossHeaderRect.left + crossHeaderRect.width / 2,
      clientY: crossHeaderRect.top + crossHeaderRect.height / 2
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, button: 0, pointerId: 92,
      clientX: crossHeaderRect.left + crossHeaderRect.width / 2,
      clientY: crossHeaderRect.top + crossHeaderRect.height / 2
    }));
    await wait(360);
    const crossPaletteColors = savedPalettes()[1]?.colors?.join('|') || '';
    check('single-row drag moves into another palette group', crossPaletteColors.split('|').includes('C813'), crossPaletteColors);
    check('cross-palette drag removes it from the original palette (move, not copy)', !(savedPalettes()[0]?.colors || []).includes('C813'));

    // 多选跨分类移动：勾选两个不连续颜色，整批拖到另一个色板。
    setLibraryResourceSelected('C815', 'palette_0', true);
    setLibraryResourceSelected('C811', 'palette_0', true);
    const multiCrossGrip = document.querySelector('.library-drag-grip[data-group-key="palette_0"][data-id="C815"]');
    const multiCrossHeader = document.querySelector('.library-group-row[data-group-key="palette_1"]');
    const multiCrossGripRect = multiCrossGrip.getBoundingClientRect();
    const multiCrossHeaderRect = multiCrossHeader.getBoundingClientRect();
    multiCrossGrip.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerId: 93,
      clientX: multiCrossGripRect.left + multiCrossGripRect.width / 2,
      clientY: multiCrossGripRect.top + multiCrossGripRect.height / 2
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, button: 0, pointerId: 93,
      clientX: multiCrossHeaderRect.left + multiCrossHeaderRect.width / 2,
      clientY: multiCrossHeaderRect.top + multiCrossHeaderRect.height / 2
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, button: 0, pointerId: 93,
      clientX: multiCrossHeaderRect.left + multiCrossHeaderRect.width / 2,
      clientY: multiCrossHeaderRect.top + multiCrossHeaderRect.height / 2
    }));
    await wait(360);
    const multiCrossSource = savedPalettes()[0]?.colors || [];
    const multiCrossTarget = savedPalettes()[1]?.colors || [];
    check('multi-selected rows move across palettes together', multiCrossTarget.includes('C815') && multiCrossTarget.includes('C811'), multiCrossTarget.join('|'));
    check('multi-cross removes every moved row from the source palette', !multiCrossSource.includes('C815') && !multiCrossSource.includes('C811'), multiCrossSource.join('|'));
    check('multi-cross preserves the selected block order', multiCrossTarget.indexOf('C815') < multiCrossTarget.indexOf('C811'), multiCrossTarget.join('|'));

    colorLibrary = libraryBeforeMultiSort;
    writeSavedPalettes(palettesBeforeMultiSort, { touchAssets: false, reason: 'multi-sort-test-restore' });
    state.palette = paletteBeforeMultiSort;
    state.activeSavedPaletteId = activeBeforeMultiSort;
    state.paletteName = nameBeforeMultiSort;
    selectedLibraryResourceIds.clear();
    selectedLibraryGroupKey = '';
    saveColorLibrary();
    renderAll();
    renderLibraryTable();
    await showDesignPage();

    const rolePickerButton = document.querySelector('.stripe-item .stripe-role-picker');
    openStripeRolePopover(rolePickerButton, 0);
    check('stripe role popover opens for color selection', !!stripeRolePopover && !!document.querySelector('.stripe-role-popover'));
    stripeRolePopover.dispatchEvent(new Event('scroll', { bubbles: false }));
    check('role popover stays open when its own color list scrolls', !!stripeRolePopover && !!document.querySelector('.stripe-role-popover'));
    const stripeListSidebar = document.querySelector('.sidebar');
    stripeListSidebar.dispatchEvent(new Event('scroll', { bubbles: false }));
    await wait(320);
    check('role popover closes when the surrounding list scrolls', !stripeRolePopover && !document.querySelector('.stripe-role-popover'));

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
