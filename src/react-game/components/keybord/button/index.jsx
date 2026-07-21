import React, { useCallback, useState } from 'react'
import cn from 'classnames'
import style from './index.module.less'
import { transform } from '../../../utils/const'
import control from '../../../control'
import { shallowEqual, useSelector } from 'react-redux'
import { initGameData } from '../../../utils/games'
import PropTypes from 'prop-types'

const Button = ({ color, size, label, position, arrow, type }) => {
  const [active, setActive] = useState(false)
  const pause = useSelector(state => state.pause, shallowEqual)
  const game = useSelector(state => state.game, shallowEqual)

  const memoHandleDown = useCallback(
    (e) => {
      e.preventDefault(); // Prevent text selection/zoom on mobile
      if (active) return;
      setActive(true)
      if (pause === 0) {
        if (control['todo'] && control['todo'][type]) control['todo'][type]()
      } else {
        const gname = initGameData[game]?.name;
        if (gname && control[gname] && control[gname][type]) {
            control[gname][type]()
        } else if (type === 'p' || type === 'r' || type === 's') {
            if (control['todo'] && control['todo'][type]) control['todo'][type]()
        }
      }
    },
    [pause, game, type, active]
  )

  const memoHandleUp = useCallback(
    (e) => {
      e.preventDefault();
      setActive(false)
      control.clearLoop()
    },
    []
  )

  return (
    <div
      className={cn({
        [style.button]: true,
        [style[color]]: true,
        [style[size]]: true,
      })}
      style={{ pointerEvents: 'auto' }}
      onPointerDown={memoHandleDown}
      onPointerUp={memoHandleUp}
      onPointerOut={memoHandleUp}
      onPointerCancel={memoHandleUp}
    >
      <i className={cn({ [style.active]: active })}>
        {/* <em style={{ transform: arrow }} /> */}
        {/* <span className={cn({ [style.position]: position })}>{label}</span> */}
      </i>
    </div>
  )
}

Button.propTypes = {
  color: PropTypes.string.isRequired,
  size: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  position: PropTypes.bool,
  arrow: PropTypes.string,
  type: PropTypes.string.isRequired,
}

export default Button
