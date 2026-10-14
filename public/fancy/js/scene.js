import * as THREE from "three";

const TAU = Math.PI * 2;

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x070605, 1);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070605, 0.045);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    this.camera.position.z = 8;

    this.wheel = this.makeWheel();
    this.scene.add(this.wheel);
    this.dust = this.makeDust();
    this.scene.add(this.dust);
    this.glass = this.makeGlass();
    this.scene.add(this.glass);
    this.resize();
  }

  makeWheel() {
    const positions = [];
    for (let index = 0; index < 144; index += 1) {
      const angle = (index / 144) * TAU;
      const inner = 0.72;
      const outer = 3.45;
      positions.push(
        Math.sin(angle) * inner,
        Math.cos(angle) * inner,
        0,
        Math.sin(angle) * outer,
        Math.cos(angle) * outer,
        0,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xeedfc9,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
    });
    const wheel = new THREE.LineSegments(geometry, material);
    wheel.position.y = -2.65;
    return wheel;
  }

  makeDust() {
    const positions = [];
    for (let index = 0; index < 90; index += 1) {
      positions.push((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 9, -1 - Math.random() * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xe2a65e,
        size: 0.025,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      }),
    );
  }

  makeGlass() {
    const group = new THREE.Group();
    const outline = [
      -0.82, 1.35, 0, -0.62, -0.75, 0,
      -0.62, -0.75, 0, -0.34, -1.24, 0,
      -0.34, -1.24, 0, 0.34, -1.24, 0,
      0.34, -1.24, 0, 0.62, -0.75, 0,
      0.62, -0.75, 0, 0.82, 1.35, 0,
      -0.82, 1.35, 0, 0.82, 1.35, 0,
      -0.62, -0.75, 0, 0.62, -0.75, 0,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(outline, 3));
    group.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: 0xfff2df, transparent: true, opacity: 0.72 }),
      ),
    );

    this.liquid = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1),
      new THREE.MeshBasicMaterial({
        color: 0xb95f18,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.liquid.position.y = -0.72;
    this.liquid.scale.y = 0.001;
    group.add(this.liquid);

    this.stream = new THREE.Mesh(
      new THREE.PlaneGeometry(0.055, 3.2),
      new THREE.MeshBasicMaterial({
        color: 0xe99a43,
        transparent: true,
        opacity: 0.84,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.stream.position.y = 2.8;
    group.add(this.stream);
    group.visible = false;
    return group;
  }

  resize = () => {
    const width = innerWidth;
    const height = innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const compact = width < 650;
    this.wheel.scale.setScalar(compact ? 0.72 : 1);
    this.wheel.position.y = compact ? -2.95 : -2.65;
    this.glass.scale.setScalar(compact ? 0.78 : 1);
  };

  setWheel({ angle, collapse = 0, opacity = 0.68, lift = 0 }) {
    this.wheel.visible = true;
    this.wheel.rotation.z = angle;
    const base = innerWidth < 650 ? 0.72 : 1;
    this.wheel.scale.set(base * Math.max(0.02, 1 - collapse * 0.98), base, base);
    this.wheel.position.y = (innerWidth < 650 ? -2.95 : -2.65) + lift;
    this.wheel.material.opacity = opacity;
  }

  setPour(progress) {
    this.glass.visible = progress > 0;
    this.wheel.visible = progress < 0.02;
    const draw = Math.min(1, progress * 2.2);
    this.glass.scale.x *= 1;
    this.glass.children[0].material.opacity = 0.72 * draw;
    const fill = Math.max(0, Math.min(1, (progress - 0.18) / 0.58));
    this.liquid.scale.y = Math.max(0.001, fill * 0.76);
    this.liquid.position.y = -1.22 + fill * 0.38;
    this.stream.visible = progress > 0.12 && progress < 0.72;
    this.stream.scale.y = Math.min(1, Math.max(0.05, progress * 2));
    this.glass.rotation.z = -0.08 * Math.sin(progress * Math.PI);
  }

  render(time) {
    this.dust.rotation.z = time * 0.008;
    this.dust.position.y = Math.sin(time * 0.12) * 0.15;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
