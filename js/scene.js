/**
 * WiseDigitalTwins - Three.js Scene Management
 */

const Scene = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    transformControls: null,
    raycaster: null,
    mouse: null,
    gridHelper: null,
    floorMesh: null,
    objects: [],
    paths: [],
    layerGroups: {},
    hiddenLayerMode: 'transparent',
    layoutConfig: null,
    isInitialized: false,

    // Layer definitions with default colors
    layers: {
        shelf: { name: '貨架', color: 0xf59e0b, visible: true },
        pallet: { name: '棧板區', color: 0xa3a3a3, visible: true },
        shipping: { name: '人工出貨區', color: 0x22c55e, visible: true },
        equipment: { name: '設備', color: 0x8b5cf6, visible: true },
        restricted: { name: '禁止移動區', color: 0xef4444, visible: true },
        agvPath: { name: 'AGV路線', color: 0x06b6d4, visible: true },
        agv: { name: 'AGV', color: 0xf472b6, visible: true },
        agvStation: { name: 'AGV出貨站', color: 0x3b82f6, visible: true }
    },

    init() {
        if (this.isInitialized) {
            this.onWindowResize();
            return;
        }

        const canvas = document.getElementById('three-canvas');
        const container = document.getElementById('viewport');

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
        this.camera.position.set(40, 30, 40);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Orbit Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 500;

        // Raycaster for object selection
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Lighting
        this.setupLighting();

        // Initialize layer groups
        Object.keys(this.layers).forEach(layer => {
            this.layerGroups[layer] = new THREE.Group();
            this.layerGroups[layer].name = layer;
            this.scene.add(this.layerGroups[layer]);
        });

        // Event listeners
        window.addEventListener('resize', () => this.onWindowResize());
        canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));

        // Start render loop
        this.animate();
        this.isInitialized = true;
    },

    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        // Directional light (sun)
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(50, 100, 50);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        directional.shadow.camera.near = 0.5;
        directional.shadow.camera.far = 500;
        directional.shadow.camera.left = -100;
        directional.shadow.camera.right = 100;
        directional.shadow.camera.top = 100;
        directional.shadow.camera.bottom = -100;
        this.scene.add(directional);

        // Hemisphere light for better ambient
        const hemisphere = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3);
        this.scene.add(hemisphere);
    },

    loadLayout(layout) {
        this.layoutConfig = layout;
        this.clearScene();
        this.createFloor(layout.width, layout.depth);
        this.createWalls(layout.width, layout.depth, layout.height);

        // Load existing objects
        if (layout.objects && layout.objects.length > 0) {
            layout.objects.forEach(objData => {
                const obj = ObjectFactory.createObject(objData.type, objData);
                if (obj) {
                    this.addObject(obj, objData.layer || objData.type);
                }
            });
        }

        // Load paths
        if (layout.paths && layout.paths.length > 0) {
            layout.paths.forEach(pathData => {
                this.createPath(pathData);
            });
        }

        // Fit camera to view
        this.fitToView();
    },

    clearScene() {
        // Clear all layer groups
        Object.keys(this.layerGroups).forEach(layer => {
            while (this.layerGroups[layer].children.length > 0) {
                this.layerGroups[layer].remove(this.layerGroups[layer].children[0]);
            }
        });

        // Remove floor and walls
        if (this.floorMesh) {
            this.scene.remove(this.floorMesh);
            this.floorMesh = null;
        }
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            this.gridHelper = null;
        }

        // Clear arrays
        this.objects = [];
        this.paths = [];
    },

    createFloor(width, depth) {
        const gridSize = 0.6; // 60cm grid
        const gridCountX = Math.ceil(width / gridSize);
        const gridCountZ = Math.ceil(depth / gridSize);

        // Floor plane
        const floorGeometry = new THREE.PlaneGeometry(width, depth);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d2d3d,
            roughness: 0.8,
            metalness: 0.2
        });
        this.floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.receiveShadow = true;
        this.floorMesh.name = 'floor';
        this.scene.add(this.floorMesh);

        // Grid helper
        this.gridHelper = new THREE.GridHelper(
            Math.max(width, depth),
            Math.max(gridCountX, gridCountZ),
            0x444466,
            0x333344
        );
        this.gridHelper.position.y = 0.01;
        this.scene.add(this.gridHelper);

        // Create grid lines texture for better visualization
        this.createGridTexture(width, depth, gridSize);
    },

    createGridTexture(width, depth, gridSize) {
        const canvas = document.createElement('canvas');
        const gridCountX = Math.ceil(width / gridSize);
        const gridCountZ = Math.ceil(depth / gridSize);
        canvas.width = gridCountX * 10;
        canvas.height = gridCountZ * 10;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2d2d3d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#3d3d4d';
        ctx.lineWidth = 1;

        for (let i = 0; i <= gridCountX; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 10, 0);
            ctx.lineTo(i * 10, canvas.height);
            ctx.stroke();
        }

        for (let j = 0; j <= gridCountZ; j++) {
            ctx.beginPath();
            ctx.moveTo(0, j * 10);
            ctx.lineTo(canvas.width, j * 10);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        if (this.floorMesh) {
            this.floorMesh.material.map = texture;
            this.floorMesh.material.needsUpdate = true;
        }
    },

    createWalls(width, depth, height) {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d3d4d,
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });

        // Create wireframe walls to show boundaries
        const wallGeometry = new THREE.BoxGeometry(width, height, depth);
        const edges = new THREE.EdgesGeometry(wallGeometry);
        const wallLines = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x4a4a6a })
        );
        wallLines.position.y = height / 2;
        wallLines.name = 'walls';
        this.scene.add(wallLines);
    },

    addObject(mesh, layer) {
        if (this.layerGroups[layer]) {
            this.layerGroups[layer].add(mesh);
            this.objects.push(mesh);
        }
    },

    removeObject(mesh) {
        const index = this.objects.indexOf(mesh);
        if (index !== -1) {
            this.objects.splice(index, 1);
        }

        // Remove from layer group
        Object.values(this.layerGroups).forEach(group => {
            if (group.children.includes(mesh)) {
                group.remove(mesh);
            }
        });

        // Dispose geometry and material
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    },

    createPath(pathData) {
        if (!pathData.points || pathData.points.length < 2) return;

        const points = pathData.points.map(p => new THREE.Vector3(p.x, 0.05, p.z));
        const curve = new THREE.CatmullRomCurve3(points, false);
        const tubePoints = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(tubePoints);

        const material = new THREE.LineBasicMaterial({
            color: pathData.color || 0x06b6d4,
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        line.userData = { type: 'agvPath', pathData: pathData };
        this.layerGroups.agvPath.add(line);
        this.paths.push(line);

        // Add direction arrows
        this.addPathArrows(points, pathData.color || 0x06b6d4);

        return line;
    },

    addPathArrows(points, color) {
        const arrowGroup = new THREE.Group();

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            const direction = new THREE.Vector3().subVectors(end, start).normalize();

            const arrowHelper = new THREE.ArrowHelper(
                direction,
                mid,
                0.5,
                color,
                0.3,
                0.2
            );
            arrowGroup.add(arrowHelper);
        }

        this.layerGroups.agvPath.add(arrowGroup);
    },

    setLayerVisibility(layer, visible) {
        if (this.layerGroups[layer]) {
            this.layers[layer].visible = visible;
            this.applyLayerVisibility(layer);
        }
    },

    applyLayerVisibility(layer) {
        const group = this.layerGroups[layer];
        const visible = this.layers[layer].visible;

        group.traverse(child => {
            if (child.isMesh || child.isLine) {
                if (visible) {
                    child.visible = true;
                    if (child.material) {
                        child.material.transparent = false;
                        child.material.opacity = 1;
                        child.material.wireframe = false;
                    }
                } else {
                    switch (this.hiddenLayerMode) {
                        case 'transparent':
                            child.visible = true;
                            if (child.material) {
                                child.material.transparent = true;
                                child.material.opacity = 0.2;
                            }
                            break;
                        case 'wireframe':
                            child.visible = true;
                            if (child.material) {
                                child.material.wireframe = true;
                            }
                            break;
                        case 'hidden':
                            child.visible = false;
                            break;
                        case 'normal':
                            child.visible = true;
                            if (child.material) {
                                child.material.transparent = false;
                                child.material.opacity = 1;
                            }
                            break;
                    }
                }
            }
        });
    },

    setHiddenLayerMode(mode) {
        this.hiddenLayerMode = mode;
        Object.keys(this.layers).forEach(layer => {
            this.applyLayerVisibility(layer);
        });
    },

    setView(viewType) {
        const layout = this.layoutConfig;
        if (!layout) return;

        const centerX = 0;
        const centerZ = 0;
        const distance = Math.max(layout.width, layout.depth) * 0.8;

        switch (viewType) {
            case 'top':
                this.camera.position.set(centerX, distance, centerZ);
                this.camera.lookAt(centerX, 0, centerZ);
                break;
            case 'front':
                this.camera.position.set(centerX, layout.height / 2, distance);
                this.camera.lookAt(centerX, layout.height / 2, centerZ);
                break;
            case 'side':
                this.camera.position.set(distance, layout.height / 2, centerZ);
                this.camera.lookAt(centerX, layout.height / 2, centerZ);
                break;
            case 'perspective':
            default:
                this.camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
                this.camera.lookAt(centerX, 0, centerZ);
                break;
        }

        this.controls.target.set(centerX, 0, centerZ);
        this.controls.update();
    },

    zoom(factor) {
        const direction = new THREE.Vector3();
        direction.subVectors(this.controls.target, this.camera.position);
        direction.multiplyScalar(1 - 1 / factor);
        this.camera.position.add(direction);
        this.controls.update();
        this.updateZoomLevel();
    },

    fitToView() {
        if (!this.layoutConfig) return;

        const distance = Math.max(this.layoutConfig.width, this.layoutConfig.depth) * 0.8;
        this.camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        this.updateZoomLevel();
    },

    updateZoomLevel() {
        const distance = this.camera.position.distanceTo(this.controls.target);
        const baseDistance = this.layoutConfig
            ? Math.max(this.layoutConfig.width, this.layoutConfig.depth) * 0.8
            : 50;
        const zoomPercent = Math.round((baseDistance / distance) * 100);
        $('#zoom-level').text(`${zoomPercent}%`);
    },

    onWindowResize() {
        const container = document.getElementById('viewport');
        if (!container || !this.camera || !this.renderer) return;

        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    onCanvasClick(event) {
        if (!this.isInitialized) return;

        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.objects, true);

        if (intersects.length > 0) {
            let selectedObj = intersects[0].object;

            // Find parent with userData if child was clicked
            while (selectedObj.parent && !selectedObj.userData.type) {
                selectedObj = selectedObj.parent;
            }

            if (window.Editor) {
                Editor.selectObject(selectedObj);
            }
        } else {
            // Check if clicking on floor for placement
            const floorIntersect = this.raycaster.intersectObject(this.floorMesh);
            if (floorIntersect.length > 0) {
                const point = floorIntersect[0].point;
                if (window.Editor && Editor.selectedObjectType) {
                    Editor.placeObject(point);
                } else if (window.Editor) {
                    Editor.deselectObject();
                }
            }
        }
    },

    onCanvasMouseMove(event) {
        if (!this.isInitialized || !this.layoutConfig) return;

        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const floorIntersect = this.raycaster.intersectObject(this.floorMesh);

        if (floorIntersect.length > 0) {
            const point = floorIntersect[0].point;
            const gridSize = this.layoutConfig.gridSize || 0.6;
            const snappedX = Math.round(point.x / gridSize) * gridSize;
            const snappedZ = Math.round(point.z / gridSize) * gridSize;

            $('#coord-x').text(snappedX.toFixed(2));
            $('#coord-y').text('0.00');
            $('#coord-z').text(snappedZ.toFixed(2));

            // Update preview position if placing object
            if (window.Editor && Editor.previewMesh) {
                Editor.previewMesh.position.set(snappedX, Editor.previewMesh.position.y, snappedZ);
            }
        }
    },

    getFloorIntersection(event) {
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.floorMesh);

        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    },

    snapToGrid(point) {
        const gridSize = this.layoutConfig ? this.layoutConfig.gridSize : 0.6;
        return {
            x: Math.round(point.x / gridSize) * gridSize,
            y: point.y,
            z: Math.round(point.z / gridSize) * gridSize
        };
    },

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        // Update AGV positions in simulation mode
        if (App.isSimulationMode && window.Simulation) {
            Simulation.update();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    // Get all objects for saving
    getSceneData() {
        const objects = [];
        const paths = [];

        Object.keys(this.layerGroups).forEach(layer => {
            this.layerGroups[layer].children.forEach(obj => {
                if (obj.userData && obj.userData.type) {
                    objects.push({
                        type: obj.userData.type,
                        layer: layer,
                        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                        rotation: obj.rotation.y,
                        ...obj.userData
                    });
                }
            });
        });

        this.paths.forEach(path => {
            if (path.userData && path.userData.pathData) {
                paths.push(path.userData.pathData);
            }
        });

        return { objects, paths };
    },

    // Capture preview image
    capturePreview() {
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/jpeg', 0.7);
    }
};
