/**
 * WiseDigitalTwins - 3D Object Factory
 * Creates all warehouse objects
 */

const ObjectFactory = {
    // Grid size in meters (60cm)
    GRID_SIZE: 0.6,

    // Default colors for each object type
    defaultColors: {
        shelf: 0xf59e0b,
        pallet: 0x8b7355,
        shipping: 0x22c55e,
        equipment: 0x8b5cf6,
        restricted: 0xef4444,
        agv: 0xf472b6,
        agvStation: 0x3b82f6
    },

    // Default outline colors
    defaultOutlineColors: {
        shelf: 0xb45309,
        pallet: 0x5c4a3a,
        shipping: 0x15803d,
        equipment: 0x6d28d9,
        restricted: 0xb91c1c,
        agv: 0xdb2777,
        agvStation: 0x1d4ed8
    },

    // Create object by type
    createObject(type, options = {}) {
        switch (type) {
            case 'shelf':
                return this.createShelf(options);
            case 'pallet':
                return this.createPallet(options);
            case 'shipping':
                return this.createShippingArea(options);
            case 'equipment':
                return this.createEquipment(options);
            case 'restricted':
                return this.createRestrictedArea(options);
            case 'agv':
                return this.createAGV(options);
            case 'agvStation':
                return this.createAGVStation(options);
            default:
                console.warn('Unknown object type:', type);
                return null;
        }
    },

    // Create a shelf unit
    createShelf(options = {}) {
        const width = (options.shelfWidth || 1) * this.GRID_SIZE;
        const depth = (options.shelfDepth || 4) * this.GRID_SIZE;
        const levels = options.shelfLevels || 5;
        const levelHeight = 0.4; // 40cm per level
        const totalHeight = levels * levelHeight;

        const color = options.color || this.defaultColors.shelf;
        const outlineColor = options.outlineColor || this.defaultOutlineColors.shelf;

        const group = new THREE.Group();

        // Create shelf frame (uprights)
        const uprightGeometry = new THREE.BoxGeometry(0.05, totalHeight, 0.05);
        const uprightMaterial = new THREE.MeshStandardMaterial({ color: outlineColor });

        // Four corner uprights
        const positions = [
            [-width / 2 + 0.025, totalHeight / 2, -depth / 2 + 0.025],
            [width / 2 - 0.025, totalHeight / 2, -depth / 2 + 0.025],
            [-width / 2 + 0.025, totalHeight / 2, depth / 2 - 0.025],
            [width / 2 - 0.025, totalHeight / 2, depth / 2 - 0.025]
        ];

        positions.forEach(pos => {
            const upright = new THREE.Mesh(uprightGeometry, uprightMaterial);
            upright.position.set(pos[0], pos[1], pos[2]);
            upright.castShadow = true;
            group.add(upright);
        });

        // Create shelving levels
        const shelfGeometry = new THREE.BoxGeometry(width - 0.1, 0.03, depth - 0.1);
        const shelfMaterial = new THREE.MeshStandardMaterial({ color: color });

        for (let i = 0; i <= levels; i++) {
            const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
            shelf.position.y = i * levelHeight;
            shelf.castShadow = true;
            shelf.receiveShadow = true;
            group.add(shelf);
        }

        // Add back panel
        const backGeometry = new THREE.BoxGeometry(width - 0.1, totalHeight, 0.02);
        const backMaterial = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.5
        });
        const back = new THREE.Mesh(backGeometry, backMaterial);
        back.position.set(0, totalHeight / 2, -depth / 2 + 0.02);
        group.add(back);

        // Add outline
        const outlineGeometry = new THREE.BoxGeometry(width, totalHeight, depth);
        const outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(outlineGeometry),
            new THREE.LineBasicMaterial({ color: outlineColor })
        );
        outline.position.y = totalHeight / 2;
        group.add(outline);

        // Set position
        if (options.position) {
            group.position.set(options.position.x, 0, options.position.z);
        }
        if (options.rotation !== undefined) {
            group.rotation.y = options.rotation;
        }

        // Store metadata
        group.userData = {
            type: 'shelf',
            name: options.name || '貨架',
            shelfWidth: options.shelfWidth || 1,
            shelfDepth: options.shelfDepth || 4,
            shelfLevels: levels,
            color: color,
            outlineColor: outlineColor
        };

        return group;
    },

    // Create a pallet area (2x2 grid = 1.2m x 1.2m)
    createPallet(options = {}) {
        const size = 2 * this.GRID_SIZE; // 1.2m
        const height = 0.15;
        const color = options.color || this.defaultColors.pallet;
        const outlineColor = options.outlineColor || this.defaultOutlineColors.pallet;

        const group = new THREE.Group();

        // Pallet base
        const baseGeometry = new THREE.BoxGeometry(size, height, size);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: color });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = height / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Pallet slats (top)
        const slatGeometry = new THREE.BoxGeometry(size, 0.02, 0.1);
        const slatMaterial = new THREE.MeshStandardMaterial({ color: 0x6b5b4f });

        for (let i = -3; i <= 3; i++) {
            const slat = new THREE.Mesh(slatGeometry, slatMaterial);
            slat.position.set(0, height + 0.01, i * 0.15);
            group.add(slat);
        }

        // Outline
        const outlineGeometry = new THREE.BoxGeometry(size, height + 0.02, size);
        const outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(outlineGeometry),
            new THREE.LineBasicMaterial({ color: outlineColor })
        );
        outline.position.y = height / 2;
        group.add(outline);

        if (options.position) {
            group.position.set(options.position.x, 0, options.position.z);
        }
        if (options.rotation !== undefined) {
            group.rotation.y = options.rotation;
        }

        group.userData = {
            type: 'pallet',
            name: options.name || '棧板區',
            color: color,
            outlineColor: outlineColor
        };

        return group;
    },

    // Create shipping area
    createShippingArea(options = {}) {
        const width = (options.areaWidth || 4) * this.GRID_SIZE;
        const depth = (options.areaDepth || 3) * this.GRID_SIZE;
        const color = options.color || this.defaultColors.shipping;
        const outlineColor = options.outlineColor || this.defaultOutlineColors.shipping;

        const group = new THREE.Group();

        // Floor marking
        const floorGeometry = new THREE.PlaneGeometry(width, depth);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.4
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.01;
        floor.receiveShadow = true;
        group.add(floor);

        // Border
        const borderShape = new THREE.Shape();
        borderShape.moveTo(-width / 2, -depth / 2);
        borderShape.lineTo(width / 2, -depth / 2);
        borderShape.lineTo(width / 2, depth / 2);
        borderShape.lineTo(-width / 2, depth / 2);
        borderShape.lineTo(-width / 2, -depth / 2);

        const borderPoints = borderShape.getPoints();
        const borderGeometry = new THREE.BufferGeometry().setFromPoints(
            borderPoints.map(p => new THREE.Vector3(p.x, 0.02, p.y))
        );
        const border = new THREE.Line(
            borderGeometry,
            new THREE.LineBasicMaterial({ color: outlineColor, linewidth: 2 })
        );
        group.add(border);

        // Shipping icon (box)
        const iconGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.4);
        const iconMaterial = new THREE.MeshStandardMaterial({ color: color });
        const icon = new THREE.Mesh(iconGeometry, iconMaterial);
        icon.position.y = 0.15;
        icon.castShadow = true;
        group.add(icon);

        // Table/counter
        const tableGeometry = new THREE.BoxGeometry(width * 0.8, 0.9, 0.6);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a5a });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(0, 0.45, -depth / 2 + 0.3);
        table.castShadow = true;
        group.add(table);

        if (options.position) {
            group.position.set(options.position.x, 0, options.position.z);
        }
        if (options.rotation !== undefined) {
            group.rotation.y = options.rotation;
        }

        group.userData = {
            type: 'shipping',
            name: options.name || '人工出貨區',
            areaWidth: options.areaWidth || 4,
            areaDepth: options.areaDepth || 3,
            color: color,
            outlineColor: outlineColor
        };

        return group;
    },

    // Create equipment (box or cylinder)
    createEquipment(options = {}) {
        const shape = options.shape || 'box';
        const color = options.color || this.defaultColors.equipment;
        const outlineColor = options.outlineColor || this.defaultOutlineColors.equipment;
        const height = options.equipHeight || 2.1;

        const group = new THREE.Group();
        let geometry, outline;

        if (shape === 'cylinder') {
            const diameter = options.equipDiameter || this.GRID_SIZE;
            geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, height, 32);
            outline = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: outlineColor })
            );
        } else {
            const length = options.equipLength || this.GRID_SIZE;
            const width = options.equipWidth || this.GRID_SIZE;
            geometry = new THREE.BoxGeometry(length, height, width);
            outline = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: outlineColor })
            );
        }

        const material = new THREE.MeshStandardMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        outline.position.y = height / 2;
        group.add(outline);

        if (options.position) {
            group.position.set(options.position.x, 0, options.position.z);
        }
        if (options.rotation !== undefined) {
            group.rotation.y = options.rotation;
        }

        group.userData = {
            type: 'equipment',
            name: options.name || '設備',
            shape: shape,
            equipLength: options.equipLength || this.GRID_SIZE,
            equipWidth: options.equipWidth || this.GRID_SIZE,
            equipHeight: height,
            equipDiameter: options.equipDiameter || this.GRID_SIZE,
            color: color,
            outlineColor: outlineColor
        };

        return group;
    },

    // Create restricted area (floor marking)
    createRestrictedArea(options = {}) {
        const width = (options.areaWidth || 2) * this.GRID_SIZE;
        const depth = (options.areaDepth || 2) * this.GRID_SIZE;
        const color = options.color || this.defaultColors.restricted;
        const outlineColor = options.outlineColor || this.defaultOutlineColors.restricted;

        const group = new THREE.Group();

        // Striped floor pattern
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Create diagonal stripes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;

        for (let i = -64; i < 128; i += 16) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 64, 64);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(width, depth);

        const floorGeometry = new THREE.PlaneGeometry(width, depth);
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            opacity: 0.7
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.02;
        group.add(floor);

        // Border
        const borderGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, depth));
        const border = new THREE.LineSegments(
            borderGeometry,
            new THREE.LineBasicMaterial({ color: outlineColor, linewidth: 2 })
        );
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.03;
        group.add(border);

        if (options.position) {
            group.position.set(options.position.x, 0, options.position.z);
        }
        if (options.rotation !== undefined) {
            group.rotation.y = options.rotation;
        }

        group.userData = {
            type: 'restricted',
            name: options.name || '禁止移動區',
            areaWidth: options.areaWidth || 2,
            areaDepth: options.areaDepth || 2,
            color: color,
            outlineColor: outlineColor
        };

        return group;
    },

    // Create AGV (Automated Guided Vehicle)
    createAGV(options = {}) {
        const color = options.color || this.defaultColors.agv;
        const outlineColor = options.outlineColor || this.defaultOutlineColors.agv;

        const group = new THREE.Group();

        // AGV body (main chassis)
        const bodyGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.15;
        body.castShadow = true;
        group.add(body);

        // Top platform
        const platformGeometry = new THREE.BoxGeometry(0.7, 0.05, 0.5);
        const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.y = 0.275;
        platform.castShadow = true;
        group.add(platform);

        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });

        const wheelPositions = [
            [-0.35, 0.08, 0.32],
            [-0.35, 0.08, -0.32],
            [0.35, 0.08, 0.32],
            [0.35, 0.08, -0.32]
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.castShadow = true;
            group.add(wheel);
        });

        // Sensors (front)
        const sensorGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.08);
        const sensorMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.3 });
        const sensor1 = new THREE.Mesh(sensorGeometry, sensorMaterial);
        sensor1.position.set(0.4, 0.2, 0.2);
        group.add(sensor1);

        const sensor2 = new THREE.Mesh(sensorGeometry, sensorMaterial);
        sensor2.position.set(0.4, 0.2, -0.2);
        group.add(sensor2);

        // Status light
        const lightGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        const statusLight = new THREE.Mesh(lightGeometry, lightMaterial);
        statusLight.position.set(0, 0.32, 0);
        statusLight.name = 'statusLight';
        group.add(statusLight);

        // Outline
        const outlineGeometry = new THREE.BoxGeometry(0.85, 0.3, 0.65);
        const outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(outlineGeometry),
            new THREE.LineBasicMaterial({ color: outlineColor })
        );
        outline.position.y = 0.15;
        group.add(outline);

        // Direction indicator (arrow)
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 0.1);
        arrowShape.lineTo(0.15, -0.1);
        arrowShape.lineTo(0.05, -0.1);
        arrowShape.lineTo(0.05, -0.2);
        arrowShape.lineTo(-0.05, -0.2);
        arrowShape.lineTo(-0.05, -0.1);
        arrowShape.lineTo(-0.15, -0.1);
        arrowShape.lineTo(0, 0.1);

        const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(0, 0.28, 0);
        group.add(arrow);

        if (options.position) {
            group.position.set(options.position.x, 0, options.position.z);
        }
        if (options.rotation !== undefined) {
            group.rotation.y = options.rotation;
        }

        // Generate AGV ID
        const agvId = options.agvId || `AGV-${String(Date.now()).slice(-4)}`;

        group.userData = {
            type: 'agv',
            name: options.name || agvId,
            agvId: agvId,
            capacity: options.capacity || 500,
            maxSpeed: options.maxSpeed || 1.5,
            battery: options.battery || 100,
            status: options.status || 'idle',
            hasCargo: options.hasCargo || false,
            cargoInfo: options.cargoInfo || null,
            currentTask: options.currentTask || null,
            targetPosition: options.targetPosition || null,
            color: color,
            outlineColor: outlineColor
        };

        return group;
    },

    // Create AGV Station
    createAGVStation(options = {}) {
        const color = options.color || this.defaultColors.agvStation;
        const outlineColor = options.outlineColor || this.defaultOutlineColors.agvStation;

        const group = new THREE.Group();

        // Platform base
        const baseGeometry = new THREE.BoxGeometry(1.2, 0.1, 1.2);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: color });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.05;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Station markers (corner poles)
        const poleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: outlineColor });

        const polePositions = [
            [-0.5, 0.35, -0.5],
            [0.5, 0.35, -0.5],
            [-0.5, 0.35, 0.5],
            [0.5, 0.35, 0.5]
        ];

        polePositions.forEach(pos => {
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);
            pole.position.set(pos[0], pos[1], pos[2]);
            pole.castShadow = true;
            group.add(pole);
        });

        // Top frame
        const frameGeometry = new THREE.BoxGeometry(1.1, 0.03, 0.03);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: outlineColor });

        const frame1 = new THREE.Mesh(frameGeometry, frameMaterial);
        frame1.position.set(0, 0.6, -0.5);
        group.add(frame1);

        const frame2 = frame1.clone();
        frame2.position.z = 0.5;
        group.add(frame2);

        const frame3 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.1), frameMaterial);
        frame3.position.set(-0.5, 0.6, 0);
        group.add(frame3);

        const frame4 = frame3.clone();
        frame4.position.x = 0.5;
        group.add(frame4);

        // Station indicator light
        const lightGeometry = new THREE.SphereGeometry(0.06, 16, 16);
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(0, 0.65, 0);
        group.add(light);

        // Charging pad symbol
        const chargeGeometry = new THREE.RingGeometry(0.15, 0.25, 6);
        const chargeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide
        });
        const chargeSymbol = new THREE.Mesh(chargeGeometry, chargeMaterial);
        chargeSymbol.rotation.x = -Math.PI / 2;
        chargeSymbol.position.y = 0.11;
        group.add(chargeSymbol);

        if (options.position) {
            group.position.set(options.position.x, 0, options.position.z);
        }
        if (options.rotation !== undefined) {
            group.rotation.y = options.rotation;
        }

        group.userData = {
            type: 'agvStation',
            name: options.name || 'AGV出貨站',
            stationId: options.stationId || `ST-${String(Date.now()).slice(-4)}`,
            color: color,
            outlineColor: outlineColor
        };

        return group;
    },

    // Update AGV status light color
    updateAGVStatus(agvGroup, status) {
        const statusLight = agvGroup.getObjectByName('statusLight');
        if (statusLight) {
            let color;
            switch (status) {
                case 'idle':
                    color = 0x00ff00; // Green
                    break;
                case 'working':
                    color = 0x0088ff; // Blue
                    break;
                case 'charging':
                    color = 0xffff00; // Yellow
                    break;
                case 'error':
                    color = 0xff0000; // Red
                    break;
                default:
                    color = 0x888888; // Gray
            }
            statusLight.material.color.setHex(color);
            statusLight.material.emissive.setHex(color);
        }
    },

    // Create cargo box on AGV
    createCargoBox(agvGroup) {
        const cargoGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.4);
        const cargoMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const cargo = new THREE.Mesh(cargoGeometry, cargoMaterial);
        cargo.position.y = 0.45;
        cargo.name = 'cargo';
        cargo.castShadow = true;
        agvGroup.add(cargo);
    },

    // Remove cargo from AGV
    removeCargoBox(agvGroup) {
        const cargo = agvGroup.getObjectByName('cargo');
        if (cargo) {
            agvGroup.remove(cargo);
            cargo.geometry.dispose();
            cargo.material.dispose();
        }
    }
};
