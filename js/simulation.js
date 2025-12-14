/**
 * WiseDigitalTwins - Simulation Module
 * Handles AGV movement simulation and time controls
 */

const Simulation = {
    isPlaying: false,
    isPaused: false,
    elapsedTime: 0, // in seconds
    speed: 1,
    lastUpdateTime: 0,
    agvs: [],
    paths: [],
    tasks: [],

    // Simulation config
    updateInterval: 16, // ~60fps
    taskGenerationInterval: 5000, // Generate new tasks every 5 seconds

    init() {
        this.bindEvents();
        this.collectAGVsAndPaths();
        this.assignInitialTasks();
        this.updateTimeDisplay();
    },

    bindEvents() {
        $('#btn-play').on('click', () => this.play());
        $('#btn-pause').on('click', () => this.pause());
        $('#btn-stop').on('click', () => this.stop());
        $('#btn-rewind').on('click', () => this.rewind());
        $('#sim-speed').on('change', (e) => {
            this.speed = parseFloat(e.target.value);
        });
    },

    collectAGVsAndPaths() {
        this.agvs = [];
        this.paths = [];

        // Collect AGVs
        if (Scene.layerGroups && Scene.layerGroups.agv) {
            Scene.layerGroups.agv.children.forEach(child => {
                if (child.userData && child.userData.type === 'agv') {
                    // Initialize simulation data
                    child.userData.simData = {
                        currentPathIndex: -1,
                        currentPointIndex: 0,
                        targetPoint: null,
                        moving: false,
                        waitTime: 0
                    };
                    this.agvs.push(child);
                }
            });
        }

        // Collect paths
        if (Scene.layerGroups && Scene.layerGroups.agvPath) {
            Scene.layerGroups.agvPath.children.forEach(child => {
                if (child.userData && child.userData.pathData) {
                    this.paths.push(child.userData.pathData);
                }
            });
        }

        // Collect stations and shelves for task generation
        this.stations = [];
        this.shelves = [];

        if (Scene.layerGroups && Scene.layerGroups.agvStation) {
            Scene.layerGroups.agvStation.children.forEach(child => {
                if (child.userData && child.userData.type === 'agvStation') {
                    this.stations.push(child);
                }
            });
        }

        if (Scene.layerGroups && Scene.layerGroups.shelf) {
            Scene.layerGroups.shelf.children.forEach(child => {
                if (child.userData && child.userData.type === 'shelf') {
                    this.shelves.push(child);
                }
            });
        }
    },

    assignInitialTasks() {
        this.agvs.forEach((agv, index) => {
            // Mock initial task assignment
            const taskTypes = ['取貨', '送貨', '充電', '待命'];
            const taskType = taskTypes[index % taskTypes.length];

            let task = {
                type: taskType,
                description: ''
            };

            switch (taskType) {
                case '取貨':
                    if (this.shelves.length > 0) {
                        const shelf = this.shelves[Math.floor(Math.random() * this.shelves.length)];
                        task.description = `前往貨架 ${shelf.userData.name || '未命名'} 取貨`;
                        task.target = shelf.position.clone();
                    }
                    break;
                case '送貨':
                    if (this.stations.length > 0) {
                        const station = this.stations[Math.floor(Math.random() * this.stations.length)];
                        task.description = `送貨至出貨站 ${station.userData.name || '未命名'}`;
                        task.target = station.position.clone();
                        agv.userData.hasCargo = true;
                        ObjectFactory.createCargoBox(agv);
                    }
                    break;
                case '充電':
                    if (this.stations.length > 0) {
                        const station = this.stations[0];
                        task.description = '前往充電站';
                        task.target = station.position.clone();
                    }
                    break;
                default:
                    task.description = '待命中';
            }

            agv.userData.currentTask = task.description;
            agv.userData.targetPosition = task.target || null;

            // Assign to nearest path if exists
            if (this.paths.length > 0 && task.target) {
                agv.userData.simData.currentPathIndex = Math.floor(Math.random() * this.paths.length);
                agv.userData.simData.moving = true;
            }
        });
    },

    play() {
        if (this.isPlaying && !this.isPaused) return;

        this.isPlaying = true;
        this.isPaused = false;
        this.lastUpdateTime = performance.now();

        $('#btn-play').hide();
        $('#btn-pause').show();

        // Start task generation
        this.taskGenerationTimer = setInterval(() => {
            this.generateNewTasks();
        }, this.taskGenerationInterval);

        App.showToast('模擬開始', 'info');
    },

    pause() {
        this.isPaused = true;
        $('#btn-play').show();
        $('#btn-pause').hide();

        if (this.taskGenerationTimer) {
            clearInterval(this.taskGenerationTimer);
        }

        App.showToast('模擬暫停', 'info');
    },

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.elapsedTime = 0;
        this.updateTimeDisplay();

        $('#btn-play').show();
        $('#btn-pause').hide();

        if (this.taskGenerationTimer) {
            clearInterval(this.taskGenerationTimer);
        }

        // Reset AGV positions and states
        this.agvs.forEach(agv => {
            agv.userData.status = 'idle';
            agv.userData.hasCargo = false;
            agv.userData.currentTask = null;
            agv.userData.targetPosition = null;
            ObjectFactory.removeCargoBox(agv);
            ObjectFactory.updateAGVStatus(agv, 'idle');

            if (agv.userData.simData) {
                agv.userData.simData.moving = false;
                agv.userData.simData.currentPointIndex = 0;
            }
        });

        App.showToast('模擬停止', 'info');
    },

    rewind() {
        // Rewind 10 seconds
        this.elapsedTime = Math.max(0, this.elapsedTime - 10);
        this.updateTimeDisplay();
        App.showToast('倒帶 10 秒', 'info');
    },

    update() {
        if (!this.isPlaying || this.isPaused) return;

        const now = performance.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000 * this.speed;
        this.lastUpdateTime = now;

        this.elapsedTime += deltaTime;
        this.updateTimeDisplay();

        // Update each AGV
        this.agvs.forEach(agv => {
            this.updateAGV(agv, deltaTime);
        });
    },

    updateAGV(agv, deltaTime) {
        const simData = agv.userData.simData;
        if (!simData || !simData.moving) return;

        const pathIndex = simData.currentPathIndex;
        if (pathIndex < 0 || pathIndex >= this.paths.length) {
            // No path assigned, move towards target directly
            if (agv.userData.targetPosition) {
                this.moveTowardsTarget(agv, agv.userData.targetPosition, deltaTime);
            }
            return;
        }

        const path = this.paths[pathIndex];
        const points = path.points;

        if (!points || points.length < 2) return;

        // Get current target point
        const currentPointIndex = simData.currentPointIndex;
        if (currentPointIndex >= points.length) {
            // Path completed, get new task
            this.completeTask(agv);
            return;
        }

        const targetPoint = new THREE.Vector3(
            points[currentPointIndex].x,
            0,
            points[currentPointIndex].z
        );

        // Move towards target
        const reached = this.moveTowardsTarget(agv, targetPoint, deltaTime);

        if (reached) {
            simData.currentPointIndex++;

            // Check if at destination
            if (simData.currentPointIndex >= points.length) {
                this.completeTask(agv);
            }
        }

        // Update AGV rotation to face movement direction
        if (currentPointIndex < points.length - 1) {
            const nextPoint = points[currentPointIndex + 1] || points[currentPointIndex];
            const direction = new THREE.Vector3(
                nextPoint.x - agv.position.x,
                0,
                nextPoint.z - agv.position.z
            );
            if (direction.length() > 0.01) {
                const angle = Math.atan2(direction.x, direction.z);
                agv.rotation.y = angle;
            }
        }
    },

    moveTowardsTarget(agv, target, deltaTime) {
        const speed = agv.userData.maxSpeed || 1.5;
        const direction = new THREE.Vector3(
            target.x - agv.position.x,
            0,
            target.z - agv.position.z
        );

        const distance = direction.length();

        if (distance < 0.1) {
            // Reached target
            agv.position.x = target.x;
            agv.position.z = target.z;
            return true;
        }

        direction.normalize();
        const moveDistance = Math.min(speed * deltaTime, distance);

        agv.position.x += direction.x * moveDistance;
        agv.position.z += direction.z * moveDistance;

        // Update status to working
        if (agv.userData.status !== 'working') {
            agv.userData.status = 'working';
            ObjectFactory.updateAGVStatus(agv, 'working');
        }

        return false;
    },

    completeTask(agv) {
        const simData = agv.userData.simData;
        simData.moving = false;
        simData.currentPointIndex = 0;

        // Handle cargo
        if (agv.userData.hasCargo) {
            agv.userData.hasCargo = false;
            ObjectFactory.removeCargoBox(agv);
            App.showToast(`${agv.userData.agvId} 完成送貨任務`, 'success');
        } else {
            App.showToast(`${agv.userData.agvId} 完成取貨任務`, 'success');
        }

        // Update status
        agv.userData.status = 'idle';
        ObjectFactory.updateAGVStatus(agv, 'idle');
        agv.userData.currentTask = '待命中';
        agv.userData.targetPosition = null;

        // Assign new task after delay
        setTimeout(() => {
            if (this.isPlaying && !this.isPaused) {
                this.assignNewTask(agv);
            }
        }, 2000);
    },

    generateNewTasks() {
        // Check idle AGVs and assign tasks
        this.agvs.forEach(agv => {
            if (agv.userData.status === 'idle' && !agv.userData.simData.moving) {
                this.assignNewTask(agv);
            }
        });
    },

    assignNewTask(agv) {
        const taskTypes = ['取貨', '送貨'];
        const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];

        let task = {
            type: taskType,
            description: ''
        };

        switch (taskType) {
            case '取貨':
                if (this.shelves.length > 0) {
                    const shelf = this.shelves[Math.floor(Math.random() * this.shelves.length)];
                    task.description = `前往貨架 ${shelf.userData.name || '未命名'} 取貨`;
                    task.target = shelf.position.clone();
                }
                break;
            case '送貨':
                if (this.stations.length > 0) {
                    const station = this.stations[Math.floor(Math.random() * this.stations.length)];
                    task.description = `送貨至出貨站 ${station.userData.name || '未命名'}`;
                    task.target = station.position.clone();
                    agv.userData.hasCargo = true;
                    ObjectFactory.createCargoBox(agv);
                }
                break;
        }

        if (task.target) {
            agv.userData.currentTask = task.description;
            agv.userData.targetPosition = task.target;

            // Find nearest path and start moving
            if (this.paths.length > 0) {
                agv.userData.simData.currentPathIndex = this.findNearestPath(agv.position);
                agv.userData.simData.currentPointIndex = 0;
            }
            agv.userData.simData.moving = true;

            agv.userData.status = 'working';
            ObjectFactory.updateAGVStatus(agv, 'working');
        }
    },

    findNearestPath(position) {
        if (this.paths.length === 0) return -1;

        let nearestIndex = 0;
        let nearestDistance = Infinity;

        this.paths.forEach((path, index) => {
            if (path.points && path.points.length > 0) {
                const firstPoint = path.points[0];
                const distance = Math.sqrt(
                    Math.pow(position.x - firstPoint.x, 2) +
                    Math.pow(position.z - firstPoint.z, 2)
                );
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            }
        });

        return nearestIndex;
    },

    updateTimeDisplay() {
        const hours = Math.floor(this.elapsedTime / 3600);
        const minutes = Math.floor((this.elapsedTime % 3600) / 60);
        const seconds = Math.floor(this.elapsedTime % 60);

        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        $('#sim-time').text(timeStr);
    },

    // Get AGV info for property panel
    getAGVInfo(agv) {
        return {
            id: agv.userData.agvId,
            status: agv.userData.status,
            hasCargo: agv.userData.hasCargo,
            currentTask: agv.userData.currentTask,
            targetPosition: agv.userData.targetPosition,
            battery: agv.userData.battery,
            position: {
                x: agv.position.x.toFixed(2),
                z: agv.position.z.toFixed(2)
            }
        };
    }
};
