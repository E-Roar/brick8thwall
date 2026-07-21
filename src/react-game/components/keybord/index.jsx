import React from 'react'
import Button from './button'

const Keyboard = () => {
  return (
    <div className="keyboard-container">
      
      {/* Left side: D-Pad */}
      <div className="dpad-container">
        <div />
        <Button color="yellow" size="s1" label="UP" type="down" />
        <div />
        
        <Button color="yellow" size="s1" label="LEFT" type="left" />
        <div />
        <Button color="yellow" size="s1" label="RIGHT" type="right" />
        
        <div />
        <Button color="yellow" size="s1" label="DOWN" type="up" />
        <div />
      </div>

      {/* Right side: Action Buttons */}
      <div className="action-container">
        <div className="small-actions">
          <Button color="yellow" size="s2" label="START" type="p" />
          <Button color="yellow" size="s2" label="SOUND" type="s" />
          <Button color="yellow" size="s2" label="RESET" type="r" />
        </div>
        <div className="rotate-action">
           <Button color="yellow" size="s0" label="ROTATE" type="rotate" />
        </div>
      </div>
      
    </div>
  )
}

export default Keyboard
