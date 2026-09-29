export function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      <directionalLight
        position={[-5, 5, -3]}
        intensity={0.6}
        color="#a0a0ff"
      />
      
      <pointLight
        position={[0, 3, -8]}
        intensity={0.8}
        color="#6366f1"
      />
      
      <pointLight
        position={[-8, 2, 5]}
        intensity={0.3}
        color="#8b5cf6"
      />
      
      <pointLight
        position={[8, 2, 5]}
        intensity={0.3}
        color="#06b6d4"
      />
    </>
  );
}
