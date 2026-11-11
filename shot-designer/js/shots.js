/**
 * Shot catalogue — camera-move presets
 *
 * Extracted verbatim from shot_designer.html by scripts/split-shot-designer.
 */
export const PL = {
    r: [24, 44]
},
    PS = {
        r: [44, 24]
    },
    HH = {
        s: .25,
        sf: 6
    };
export const CATS = [
    ['Cinematic', [
        ['Dolly Shot', {
            r: [46, 24]
        }],
        ['Reverse Dolly Shot', {
            r: [24, 46]
        }],
        ['Birds Eye Twist', {
            h: [8, 60],
            r: [40, 4],
            o: [0, 90]
        }],
        ['Crane Shot Side', {
            a: [-35, -35],
            h: [3, 24]
        }],
        ['Crane Shot Sweep', {
            a: [-50, 30],
            h: [3, 26]
        }],
        ['360 Pan + Tilt', {
            y: [0, 360],
            p: [-15, 20],
            d: 10
        }],
        ['180 Degree Pan', {
            y: [-90, 90],
            d: 8
        }],
        ['90 Degree Pan', {
            y: [-45, 45]
        }],
        ['Track Back Pan Down', {
            r: [24, 48],
            p: [10, -22]
        }],
        ['Track Back Pan Up', {
            r: [24, 48],
            p: [-15, 10]
        }],
        ['Push Forward Pan Down', {
            r: [48, 24],
            p: [5, -22]
        }],
        ['Push Forward Pan Up', {
            r: [48, 24],
            p: [-12, 10]
        }],
        ['Pan Back + Flip', {
            r: [24, 50],
            o: [0, 180]
        }],
        ['Pan Back + Flip (Handheld)', {
            r: [24, 50],
            o: [0, 180],
            ...HH
        }],
        ['J Move Up', {
            r: [44, 30],
            h: [4, 28],
            e: 'in'
        }],
        ['J Move Down', {
            r: [30, 44],
            h: [28, 4],
            e: 'out'
        }],
        ['L Move Up', {
            r: [44, 26],
            h: [5, 26],
            ph: 1,
            d: 8
        }],
        ['L Move Down', {
            r: [26, 44],
            h: [26, 5],
            ph: 2,
            d: 8
        }],
        ['Spiral Up', {
            a: [0, 270],
            h: [4, 28],
            r: [44, 30],
            d: 9
        }],
        ['Spiral Down', {
            a: [0, 270],
            h: [28, 4],
            r: [30, 44],
            d: 9
        }],
        ['360 Track', {
            a: [0, 360],
            d: 12,
            e: 'lin'
        }],
        ['Slide Right', {
            x: [-18, 18]
        }],
        ['Slide Left', {
            x: [18, -18]
        }],
        ['Slide Up', {
            v: [-4, 14]
        }],
        ['Slide Down', {
            v: [14, -4]
        }],
        ['Under To Above', {
            h: [.3, 30],
            r: [42, 26]
        }]
    ]],
    ['FPV', [
        ['Automatic Gun Fire', {
            s: .5,
            sf: 22,
            r: [36, 34],
            d: 3
        }],
        ['Base Jump FPV', {
            h: [45, 3],
            r: [75, 30],
            p: [-25, -5],
            s: .4,
            sf: 14,
            e: 'in',
            d: 7
        }],
        ['Bleeding Out', {
            s: .12,
            o: [0, 25],
            f: [55, 40],
            p: [0, -25],
            e: 'in',
            d: 8
        }],
        ['Explosion', {
            s: 2.4,
            sf: 18,
            sd: 4,
            d: 3
        }],
        ['Fall Backwards', {
            p: [0, 60],
            h: [7, 1],
            o: [0, -10],
            e: 'in',
            d: 3
        }],
        ['Flinch', {
            s: 1.6,
            sf: 14,
            sd: 8,
            d: 1.6
        }],
        ['Look Around', {
            y: [-45, 45],
            p: [-8, 8],
            s: .05,
            d: 8
        }],
        ['Static Handheld Subtle', {
            s: .12,
            sf: 5,
            d: 6
        }],
        ['Turn, Look Up', {
            y: [-60, 0],
            p: [-5, 38],
            d: 5
        }],
        ['Jet Pass 01', {
            x: [-140, 140],
            tr: 1,
            r: [30, 30],
            h: [9, 9],
            o: [-10, 10],
            s: .3,
            sf: 16,
            e: 'lin',
            d: 3
        }],
        ['Jet Pass 02', {
            x: [140, -140],
            tr: 1,
            r: [26, 26],
            h: [14, 10],
            o: [10, -10],
            s: .3,
            sf: 16,
            e: 'lin',
            d: 3
        }]
    ]],
    ['Pans', [
        ['Pan Down', {
            p: [15, -15]
        }],
        ['Pan Up', {
            p: [-15, 15]
        }],
        ['Pan Left', {
            y: [-25, 25]
        }],
        ['Pan Left Handheld', {
            y: [-25, 25],
            ...HH
        }],
        ['Pan Right', {
            y: [25, -25]
        }],
        ['Pan Right Handheld', {
            y: [25, -25],
            ...HH
        }],
        ['Scenic Pan Left', {
            y: [-40, 40],
            f: [45, 45],
            d: 12
        }],
        ['Scenic Pan Right', {
            y: [40, -40],
            f: [45, 45],
            d: 12
        }]
    ]],
    ['Speed Ramps', [
        ['180 Degree Spin (Anti-Clockwise)', {
            a: [0, -180],
            e: 'ramp',
            d: 7
        }],
        ['180 Degree Spin (Clockwise)', {
            a: [0, 180],
            e: 'ramp',
            d: 7
        }],
        ['Contra-Zoom', {
            r: [26, 60],
            f: [80, 40],
            e: 'ramp'
        }],
        ['Crane Shot Down', {
            h: [28, 3],
            e: 'ramp'
        }],
        ['Crane Shot Up', {
            h: [3, 28],
            e: 'ramp'
        }],
        ['Move Down', {
            v: [8, -8],
            e: 'ramp'
        }],
        ['Move Up', {
            v: [-8, 8],
            e: 'ramp'
        }],
        ['Move Left', {
            x: [18, -18],
            e: 'ramp'
        }],
        ['Move Right', {
            x: [-18, 18],
            e: 'ramp'
        }],
        ['Pull Back', {
            r: [24, 50],
            e: 'ramp'
        }],
        ['Pull Pan Down', {
            r: [24, 50],
            p: [8, -20],
            e: 'ramp'
        }],
        ['Pull Pan Up', {
            r: [24, 50],
            p: [-10, 14],
            e: 'ramp'
        }],
        ['Pull Rise', {
            r: [26, 50],
            h: [4, 26],
            e: 'ramp'
        }],
        ['Push Down', {
            r: [50, 26],
            h: [26, 6],
            e: 'ramp'
        }],
        ['Push In', {
            r: [50, 24],
            e: 'ramp'
        }],
        ['Push Pan Down', {
            r: [50, 24],
            p: [6, -20],
            e: 'ramp'
        }],
        ['Push Pan Up', {
            r: [50, 24],
            p: [-10, 12],
            e: 'ramp'
        }],
        ['Twist In', {
            r: [50, 24],
            o: [0, 45],
            e: 'ramp'
        }],
        ['Twist Out', {
            r: [24, 50],
            o: [45, 0],
            e: 'ramp'
        }]
    ]],
    ['Pushes + Pulls', [
        ['Fast Pull', {
            ...PL,
            d: 2.5
        }],
        ['Long Pull', {
            r: [16, 70],
            d: 9
        }],
        ['Medium Pull', {
            ...PL,
            d: 6
        }],
        ['Pull Handheld', {
            ...PL,
            ...HH
        }],
        ['Slow Pull', {
            ...PL,
            d: 12
        }],
        ['Pull Rise'],
        ['Pull to Birds Eye', {
            r: [36, 4],
            h: [6, 55],
            d: 8
        }],
        ['Twist Pull', {
            ...PL,
            o: [0, 60]
        }],
        ['Fast Push', {
            ...PS,
            d: 2.5
        }],
        ['Long Push', {
            r: [70, 16],
            d: 9
        }],
        ['Medium Push', {
            ...PS,
            d: 6
        }],
        ['Push Handheld', {
            ...PS,
            ...HH
        }],
        ['Slow Push', {
            ...PS,
            d: 12
        }],
        ['Push Sink', {
            r: [44, 26],
            h: [14, 2]
        }],
        ['Twist Push', {
            ...PS,
            o: [0, -60]
        }],
        ['Push To Sky', {
            r: [44, 28],
            p: [0, 45]
        }],
        ['Push To Ground', {
            r: [44, 28],
            p: [0, -30],
            h: [10, 3]
        }]
    ]],
    ['Flyovers', [
        ['Flyover Zoom', {
            r: [80, 10],
            h: [40, 14],
            f: [45, 70],
            d: 9
        }],
        ['Helicopter Flyover_001', {
            a: [-70, 70],
            r: [50, 36],
            h: [30, 22],
            s: .15,
            sf: 7,
            d: 10
        }],
        ['Helicopter Flyover_002', {
            a: [60, -120],
            r: [56, 30],
            h: [24, 34],
            s: .15,
            sf: 7,
            d: 10
        }],
        ['Slow Flyover', {
            r: [70, 14],
            h: [26, 16],
            d: 16
        }],
        ['Mini Spy Drone', {
            a: [-20, 40],
            h: [3, 5],
            r: [22, 12],
            s: .1,
            sf: 3,
            dr: .3,
            f: [75, 75],
            d: 10
        }]
    ]],
    ['Zooms', [
        ['Contra-Zoom'],
        ['Contra-Zoom 2', {
            r: [60, 26],
            f: [40, 80]
        }],
        ['Fast Zoom', {
            f: [55, 20],
            d: 2
        }],
        ['Handheld Zoom In', {
            f: [55, 25],
            ...HH
        }],
        ['Handheld Zoom Out', {
            f: [25, 55],
            ...HH
        }],
        ['Slow Zoom', {
            f: [55, 25],
            d: 12
        }],
        ['Twist Zoom', {
            f: [55, 22],
            o: [0, 45]
        }],
        ['Zoom In Pan Left', {
            f: [60, 24],
            y: [-15, 10]
        }],
        ['Zoom In Pan Right', {
            f: [60, 24],
            y: [15, -10]
        }],
        ['Zoom Out Pan Up', {
            f: [22, 60],
            p: [-10, 15]
        }],
        ['Zoom In Pan Down', {
            f: [60, 24],
            p: [10, -15]
        }],
        ['Sinister Twist Zoom In', {
            f: [70, 20],
            o: [0, -30],
            e: 'in'
        }],
        ['Sinister Twist Zoom Out', {
            f: [20, 70],
            o: [-30, 0],
            e: 'out'
        }]
    ]],
    ['Chaotic', [
        ['Backwards Running', {
            r: [26, 50],
            bob: .35,
            bf: 11,
            s: .2,
            sf: 11
        }],
        ['Drunk Cam', {
            dr: 1,
            r: [40, 34],
            s: .05,
            d: 10
        }],
        ['Static Handheld Subtle'],
        ['Forwards Running', {
            r: [50, 24],
            bob: .35,
            bf: 11,
            s: .2,
            sf: 11
        }],
        ['Sideways Running', {
            x: [-25, 25],
            bob: .35,
            bf: 11,
            s: .2,
            sf: 11,
            e: 'lin'
        }],
        ['Traffic Weaving', {
            r: [50, 18],
            wv: 5,
            s: .15,
            sf: 10,
            e: 'lin',
            d: 8
        }],
        ['Walking', {
            r: [46, 32],
            bob: .15,
            bf: 5.5,
            s: .05,
            e: 'lin',
            d: 9
        }],
        ['Missile Strike', {
            r: [90, 4],
            h: [40, 1],
            o: [0, 180],
            s: .3,
            sf: 20,
            e: 'in',
            d: 4
        }],
        ['Curved Missile Strike', {
            a: [80, 0],
            r: [100, 6],
            h: [40, 1],
            o: [0, 360],
            s: .3,
            sf: 20,
            e: 'in',
            d: 4
        }],
        ['Space Camera Floating', {
            a: [0, 25],
            h: [10, 18],
            r: [60, 55],
            o: [0, 12],
            dr: .3,
            d: 14
        }],
        ['Space Camera Floating 2', {
            a: [0, -30],
            h: [20, 8],
            r: [55, 62],
            o: [0, -15],
            dr: .4,
            d: 14
        }],
        ['Space Camera Floating 3', {
            a: [10, 40],
            h: [6, 30],
            r: [50, 66],
            o: [5, 20],
            dr: .5,
            d: 14
        }],
        ['Spinning In Space', {
            a: [0, 90],
            o: [0, 720],
            h: [30, 40],
            e: 'lin',
            d: 10
        }],
        ['Fast Car Flyby (left to right)', {
            x: [-70, 70],
            tr: 1,
            r: [22, 22],
            h: [1.5, 1.5],
            e: 'lin',
            d: 2.5
        }],
        ['Fast Car Flyby (right to left)', {
            x: [70, -70],
            tr: 1,
            r: [22, 22],
            h: [1.5, 1.5],
            e: 'lin',
            d: 2.5
        }],
        ['Handheld Transition Right', {
            x: [-6, 26],
            y: [0, -25],
            o: [0, 8],
            s: .5,
            sf: 12,
            e: 'ramp',
            d: 2
        }],
        ['Handheld Transition Left', {
            x: [6, -26],
            y: [0, 25],
            o: [0, -8],
            s: .5,
            sf: 12,
            e: 'ramp',
            d: 2
        }]
    ]]
];
