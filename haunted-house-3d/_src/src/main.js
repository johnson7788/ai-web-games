import { Game } from './Game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
// QA / automation hook (read-only intent): lets smoke tests verify state deterministically.
window.__HAUNTED_GAME__ = game;

const title = document.getElementById('title-screen');
title.addEventListener('click', () => {
  title.classList.add('hidden');
  game.start();
}, { once: true });
