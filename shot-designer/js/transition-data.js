/**
 * Transition + curve tables
 *
 * Extracted verbatim from shot_designer.html by scripts/split-shot-designer.
 */
export const TRN = [
    ['none', 'None (cut)', []],
    ['dissolve', 'Cross dissolve', ['spd']],
    ['dip', 'Dip to colour', ['col', 'op', 'spd']],
    ['flash', 'Flash (additive)', ['col', 'op', 'spd']],
    ['wipe', 'Wipe', ['rot', 'amt', 'spd']],
    ['slide', 'Slide over', ['rot', 'spd']],
    ['push', 'Push', ['rot', 'col', 'spd']],
    ['iris', 'Iris', ['amt', 'spd']],
    ['split', 'Split (barn doors)', ['rot', 'spd']],
    ['zoom', 'Zoom through', ['amt', 'spd']],
    ['spin', 'Spin', ['rot', 'spd']],
    ['blur', 'Blur dissolve', ['amt', 'spd']],
    ['pix', 'Pixelate', ['amt', 'spd']]
];
export const DEFT = {
    type: 'dissolve',
    len: 1,
    col: '#000000',
    op: 1,
    rot: 0,
    amt: .5,
    spd: 2
};
export const PC = {
    col: ['Colour', 'color'],
    op: ['Opacity', 0, 1, .05],
    rot: ['Rotation °', -180, 180, 15],
    amt: ['Amount', 0, 1, .05],
    spd: ['Ease', 1, 4, .25]
};
export const CVP = [
    [0, 0, 1, 1],
    [.25, .1, .25, 1],
    [.42, 0, 1, 1],
    [0, 0, .58, 1],
    [.42, 0, .58, 1],
    [.34, 1.56, .64, 1]
],
    CVN = ['Linear', 'Ease', 'In', 'Out', 'In-Out', 'Overshoot'];
