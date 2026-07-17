import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { buttonHover, withReducedMotion } from '../motion'

function MotionButton({
  children,
  className,
  style,
  type = 'button',
  disabled,
  onClick,
  as: Tag,
  ...rest
}) {
  const reduced = useReducedMotion()
  const Component = Tag || motion.button

  return (
    <Component
      type={Tag ? undefined : type}
      className={className}
      style={style}
      disabled={disabled}
      onClick={onClick}
      variants={withReducedMotion(reduced, buttonHover)}
      initial="rest"
      whileHover={disabled || reduced ? undefined : 'hover'}
      whileTap={disabled || reduced ? undefined : 'tap'}
      {...rest}
    >
      {children}
    </Component>
  )
}

export default MotionButton
