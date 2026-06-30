/** @file Константы игры — единый источник правды (game-designer / game-engine) */
const CONFIG = {
    FIXED_HZ: 60,
    FIXED_DT: 1 / 60,

    gravity: 0.55,
    jumpForce: -15,
    maxJumps: 2,
    maxFallSpeed: 20,

    walkSpeed: 10,
    moveSpeed: 11,
    airControl: 0.42,
    friction: 0.88,
    groundFriction: 0.82,

    touchFollow: 0.9,
    touchAirPush: 0.55,

    breakableWarningSec: 2,
    cameraSmooth: 0.1,
    collectibleRate: 0.28,

    platformMinW: 70,
    platformMaxW: 160,
    platformH: 24,

    palette: {
        skyTop: '#030308',
        skyMid: '#0a0a22',
        skyBot: '#141432',
        spiderRed: '#e63946',
        spiderBlue: '#1a3b8e',
        accent: '#00cec9',
        gold: '#fdcb6e',
        pink: '#fd79a8',
        platforms: ['#6c5ce7', '#a29bfe', '#fd79a8', '#00cec9', '#fdcb6e', '#e17055']
    },

    difficulty: {
        easy:   { gap: 155, ramp: 0.00012, jump: -16.5 },
        medium: { gap: 125, ramp: 0.00028, jump: -15 },
        hard:   { gap: 95,  ramp: 0.00048, jump: -14 }
    },

    mobile: {
        walkSpeed: 13,
        moveSpeed: 12,
        jumpForce: -16.5,
        airControl: 0.55,
        touchFollow: 1.05
    }
};

const INTEGRITY_SALT = 'bndt_spdr_v3';
