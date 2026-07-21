import React, { useEffect, useState } from 'react'
import Keyboard from '../components/keybord'
import Number from '../components/number'
import Music from '../components/music'
import Pause from '../components/pause'
import Welcome from '../components/welcome'
import { shallowEqual, useSelector } from 'react-redux'
import TetrisPanel from '../components/tetris-panel'
import SnakePanel from '../components/snake-panel'
import ShootingPanel from '../components/shooting-panel'
import Logo from '../components/logo'
import BreakoutPanel from '../components/breakout-panel'
import RacingPanel from '../components/rancing-panel'
import TankPanel from '../components/tank-panel'

const App = () => {
  const { levels, speed, music, pause, game, games } = useSelector((state) => ({
    levels: state.levels,
    speed: state.speed,
    music: state.music,
    pause: state.pause,
    game: state.game,
    games: state.games
  }), shallowEqual)

  return (
    <>
      {/* Hidden game panels — Redux state is rendered to 3D canvas via BrickGameScreen.ts */}
      <div style={{ display: 'none' }}>
        {games[game].name === 'tetris' && <TetrisPanel />}
        {games[game].name === 'snake' && <SnakePanel />}
        {games[game].name === 'shooting' && <ShootingPanel />}
        {games[game].name === 'racing' && <RacingPanel />}
        {games[game].name === 'breakout' && <BreakoutPanel />}
        {games[game].name === 'tank' && <TankPanel />}
      </div>

      {/* Visible keyboard overlay — positioned by #react-root in style.css */}
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        paddingBottom: '70px',
        pointerEvents: 'none',
      }}>
        <div style={{
          transform: 'scale(0.55)',
          transformOrigin: 'bottom center',
          pointerEvents: 'auto',
        }}>
          <Keyboard filling={0} />
        </div>
      </div>
    </>
  )
}

export default App
