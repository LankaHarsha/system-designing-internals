import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

const BASE = './assets/kaykit/'

// A KayKit prop by name, e.g. <Prop name="furniture/couch_pillows" />.
// Every instance clones the loaded scene so one file can be placed many times.
export default function Prop({ name, ...props }) {
  const { scene } = useGLTF(`${BASE}${name}.gltf`)
  const model = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true }
    })
    return c
  }, [scene])
  return <primitive object={model} {...props} />
}
