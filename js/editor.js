/**
 * WiseDigitalTwins - Editor Module
 * Handles object placement, selection, and editing
 */

const Editor = {
    selectedObject: null,
    selectedObjectType: null,
    previewMesh: null,
    isDrawingPath: false,
    pathPoints: [],
    tempPathLine: null,
    agvCount: 0,
    maxAGVs: 30,
    isInitialized: false,

    // Undo/Redo system
    history: [],
    historyIndex: -1,
    maxHistorySteps: 10,

    init() {
        // Prevent duplicate event binding
        if (!this.isInitialized) {
            this.bindEvents();
            this.isInitialized = true;
        }
        this.countExistingAGVs();
        // Reset state
        this.selectedObject = null;
        this.selectedObjectType = null;
        this.history = [];
        this.historyIndex = -1;
        this.updateHistoryButtons();
    },

    bindEvents() {
        // Object palette click
        $('.object-item').on('click', (e) => {
            const type = $(e.currentTarget).data('type');
            this.selectObjectType(type);
        });

        // Object palette drag start
        $('.object-item').on('dragstart', (e) => {
            const type = $(e.currentTarget).data('type');
            e.originalEvent.dataTransfer.setData('objectType', type);
            this.selectObjectType(type);
        });

        // Viewport drag events
        $('#viewport').on('dragover', (e) => {
            e.preventDefault();
        });

        $('#viewport').on('drop', (e) => {
            e.preventDefault();
            const type = e.originalEvent.dataTransfer.getData('objectType');
            if (type) {
                const point = Scene.getFloorIntersection(e.originalEvent);
                if (point) {
                    this.placeObject(point);
                }
            }
        });

        // Property form changes
        $('#prop-name').on('change', () => this.updateSelectedObjectProperty('name', $('#prop-name').val()));
        $('#prop-x').on('change', () => this.updatePosition());
        $('#prop-z').on('change', () => this.updatePosition());
        $('#prop-rotation').on('change', () => this.updateRotation());
        $('#prop-color').on('change', () => this.updateColor());
        $('#prop-outline-color').on('change', () => this.updateOutlineColor());

        // Shelf properties
        $('#prop-shelf-width, #prop-shelf-depth, #prop-shelf-levels').on('change', () => {
            this.rebuildSelectedShelf();
        });

        // Equipment properties
        $('#prop-equip-shape').on('change', (e) => {
            if (e.target.value === 'cylinder') {
                $('.box-dims').hide();
                $('.cylinder-dims').show();
            } else {
                $('.box-dims').show();
                $('.cylinder-dims').hide();
            }
            this.rebuildSelectedEquipment();
        });

        $('#prop-equip-length, #prop-equip-width, #prop-equip-height, #prop-equip-diameter').on('change', () => {
            this.rebuildSelectedEquipment();
        });

        // AGV properties
        $('#prop-agv-capacity, #prop-agv-speed, #prop-agv-battery, #prop-agv-status').on('change', () => {
            this.updateAGVProperties();
        });

        // Delete button
        $('#btn-delete-object').on('click', () => this.deleteSelectedObject());

        // Equipment modal confirm
        $('#btn-confirm-equipment').on('click', () => this.confirmEquipmentCreation());
    },

    selectObjectType(type) {
        // Check AGV limit
        if (type === 'agv' && this.agvCount >= this.maxAGVs) {
            App.showToast(`AGV數量已達上限 (${this.maxAGVs})`, 'error');
            return;
        }

        // Handle equipment modal
        if (type === 'equipment') {
            App.showModal('equipment-modal');
            return;
        }

        // Deselect previous
        $('.object-item').removeClass('selected');
        $(`.object-item[data-type="${type}"]`).addClass('selected');

        this.selectedObjectType = type;

        // Remove previous preview
        if (this.previewMesh) {
            Scene.scene.remove(this.previewMesh);
            this.previewMesh = null;
        }

        // Create preview mesh
        if (type !== 'agvPath') {
            this.createPreviewMesh(type);
        } else {
            // Start path drawing mode
            this.startPathDrawing();
        }

        // Change cursor
        $('#viewport').addClass('drawing-mode');
    },

    createPreviewMesh(type, options = {}) {
        const mesh = ObjectFactory.createObject(type, options);
        if (mesh) {
            // Make it semi-transparent
            mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.transparent = true;
                    child.material.opacity = 0.5;
                }
            });
            this.previewMesh = mesh;
            Scene.scene.add(mesh);
        }
    },

    confirmEquipmentCreation() {
        const shape = $('#new-equip-shape').val();
        const options = {
            shape: shape,
            equipHeight: parseFloat($('#new-equip-height').val()) || 2.1
        };

        if (shape === 'cylinder') {
            options.equipDiameter = parseFloat($('#new-equip-diameter').val()) || 0.6;
        } else {
            options.equipLength = parseFloat($('#new-equip-length').val()) || 0.6;
            options.equipWidth = parseFloat($('#new-equip-width').val()) || 0.6;
        }

        App.hideAllModals();

        // Deselect previous
        $('.object-item').removeClass('selected');
        $(`.object-item[data-type="equipment"]`).addClass('selected');

        this.selectedObjectType = 'equipment';
        this.pendingEquipmentOptions = options;

        // Create preview
        this.createPreviewMesh('equipment', options);
        $('#viewport').addClass('drawing-mode');
    },

    startPathDrawing() {
        this.isDrawingPath = true;
        this.pathPoints = [];

        // Add path drawing instructions
        App.showToast('點擊地面繪製路線，雙擊結束', 'info');

        // Bind path drawing events
        $('#three-canvas').on('click.pathDraw', (e) => this.addPathPoint(e));
        $('#three-canvas').on('dblclick.pathDraw', () => this.finishPathDrawing());
        $(document).on('keydown.pathDraw', (e) => {
            if (e.key === 'Escape') {
                this.cancelPathDrawing();
            } else if (e.key === 'Enter') {
                this.finishPathDrawing();
            }
        });
    },

    addPathPoint(e) {
        if (!this.isDrawingPath) return;

        const point = Scene.getFloorIntersection(e.originalEvent);
        if (point) {
            const snapped = Scene.snapToGrid(point);
            this.pathPoints.push({ x: snapped.x, z: snapped.z });

            // Update temp path line
            this.updateTempPathLine();
        }
    },

    updateTempPathLine() {
        // Remove old temp line
        if (this.tempPathLine) {
            Scene.scene.remove(this.tempPathLine);
        }

        if (this.pathPoints.length < 2) return;

        const points = this.pathPoints.map(p => new THREE.Vector3(p.x, 0.05, p.z));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x06b6d4 });
        this.tempPathLine = new THREE.Line(geometry, material);
        Scene.scene.add(this.tempPathLine);
    },

    finishPathDrawing() {
        if (this.pathPoints.length < 2) {
            App.showToast('路線至少需要兩個點', 'error');
            return;
        }

        // Save state for undo
        this.saveState();

        // Create permanent path
        const pathData = {
            id: Date.now().toString(),
            points: [...this.pathPoints],
            color: 0x06b6d4
        };

        Scene.createPath(pathData);

        // Cleanup
        this.cancelPathDrawing();
        App.showToast('路線已建立', 'success');
    },

    cancelPathDrawing() {
        this.isDrawingPath = false;
        this.pathPoints = [];

        if (this.tempPathLine) {
            Scene.scene.remove(this.tempPathLine);
            this.tempPathLine = null;
        }

        // Unbind path events
        $('#three-canvas').off('.pathDraw');
        $(document).off('.pathDraw');

        // Deselect
        $('.object-item').removeClass('selected');
        this.selectedObjectType = null;
        $('#viewport').removeClass('drawing-mode');
    },

    placeObject(point) {
        if (!this.selectedObjectType || this.isDrawingPath) return;

        // Snap to grid
        const snapped = Scene.snapToGrid(point);

        // Save state for undo
        this.saveState();

        // Create actual object
        let options = {
            position: { x: snapped.x, y: 0, z: snapped.z }
        };

        // Add pending equipment options if any
        if (this.selectedObjectType === 'equipment' && this.pendingEquipmentOptions) {
            options = { ...options, ...this.pendingEquipmentOptions };
        }

        const obj = ObjectFactory.createObject(this.selectedObjectType, options);
        if (obj) {
            Scene.addObject(obj, this.selectedObjectType);

            if (this.selectedObjectType === 'agv') {
                this.agvCount++;
            }

            // Clear selection
            this.clearPlacementMode();

            // Select the new object
            this.selectObject(obj);

            App.showToast('物件已放置', 'success');
        }
    },

    clearPlacementMode() {
        if (this.previewMesh) {
            Scene.scene.remove(this.previewMesh);
            this.previewMesh = null;
        }
        this.selectedObjectType = null;
        this.pendingEquipmentOptions = null;
        $('.object-item').removeClass('selected');
        $('#viewport').removeClass('drawing-mode');
    },

    selectObject(obj) {
        // Deselect previous
        this.deselectObject();

        if (!obj || !obj.userData || !obj.userData.type) return;

        this.selectedObject = obj;

        // Highlight selected object
        obj.traverse(child => {
            if (child.isMesh && child.material && !child.material._originalEmissive) {
                child.material._originalEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0);
                child.material.emissive = new THREE.Color(0x333355);
            }
        });

        // Show property panel
        this.showPropertyPanel(obj);
    },

    deselectObject() {
        if (this.selectedObject) {
            // Remove highlight
            this.selectedObject.traverse(child => {
                if (child.isMesh && child.material && child.material._originalEmissive) {
                    child.material.emissive = child.material._originalEmissive;
                    delete child.material._originalEmissive;
                }
            });
            this.selectedObject = null;
        }

        // Hide property panel
        $('#property-editor').hide();
        $('#no-selection').show();

        // Hide all type-specific sections
        $('.shelf-props, .equipment-props, .agv-props, .agv-simulation-props').hide();
    },

    showPropertyPanel(obj) {
        const data = obj.userData;

        $('#no-selection').hide();
        $('#property-editor').show();

        // Common properties
        const typeNames = {
            shelf: '貨架',
            pallet: '棧板區',
            shipping: '人工出貨區',
            equipment: '設備',
            restricted: '禁止移動區',
            agv: 'AGV',
            agvStation: 'AGV出貨站'
        };

        $('#prop-type').val(typeNames[data.type] || data.type);
        $('#prop-name').val(data.name || '');
        $('#prop-x').val(obj.position.x.toFixed(2));
        $('#prop-z').val(obj.position.z.toFixed(2));
        $('#prop-rotation').val(Math.round(THREE.MathUtils.radToDeg(obj.rotation.y)));
        $('#prop-color').val('#' + new THREE.Color(data.color).getHexString());
        $('#prop-outline-color').val('#' + new THREE.Color(data.outlineColor).getHexString());

        // Hide all type-specific sections first
        $('.shelf-props, .equipment-props, .agv-props, .agv-simulation-props').hide();

        // Show type-specific properties
        switch (data.type) {
            case 'shelf':
                $('.shelf-props').show();
                $('#prop-shelf-width').val(data.shelfWidth);
                $('#prop-shelf-depth').val(data.shelfDepth);
                $('#prop-shelf-levels').val(data.shelfLevels);
                break;

            case 'equipment':
                $('.equipment-props').show();
                $('#prop-equip-shape').val(data.shape);
                if (data.shape === 'cylinder') {
                    $('.box-dims').hide();
                    $('.cylinder-dims').show();
                    $('#prop-equip-diameter').val(data.equipDiameter);
                } else {
                    $('.box-dims').show();
                    $('.cylinder-dims').hide();
                    $('#prop-equip-length').val(data.equipLength);
                    $('#prop-equip-width').val(data.equipWidth);
                }
                $('#prop-equip-height').val(data.equipHeight);
                break;

            case 'agv':
                $('.agv-props').show();
                $('#prop-agv-id').val(data.agvId);
                $('#prop-agv-capacity').val(data.capacity);
                $('#prop-agv-speed').val(data.maxSpeed);
                $('#prop-agv-battery').val(data.battery);
                $('#prop-agv-status').val(data.status);

                // Show simulation props if in simulation mode
                if (App.isSimulationMode) {
                    $('.agv-simulation-props').show();
                    $('#prop-agv-cargo').text(data.hasCargo ? '有載貨' : '無');
                    $('#prop-agv-task').text(data.currentTask || '無排定任務');
                    $('#prop-agv-target').text(data.targetPosition ?
                        `(${data.targetPosition.x.toFixed(1)}, ${data.targetPosition.z.toFixed(1)})` : '-');
                }
                break;
        }
    },

    updatePosition() {
        if (!this.selectedObject) return;

        this.saveState();

        const x = parseFloat($('#prop-x').val()) || 0;
        const z = parseFloat($('#prop-z').val()) || 0;

        this.selectedObject.position.x = x;
        this.selectedObject.position.z = z;
    },

    updateRotation() {
        if (!this.selectedObject) return;

        this.saveState();

        const degrees = parseFloat($('#prop-rotation').val()) || 0;
        this.selectedObject.rotation.y = THREE.MathUtils.degToRad(degrees);
    },

    updateColor() {
        if (!this.selectedObject) return;

        this.saveState();

        const color = $('#prop-color').val();
        const colorHex = parseInt(color.replace('#', '0x'));

        this.selectedObject.userData.color = colorHex;

        // Update mesh colors
        this.selectedObject.traverse(child => {
            if (child.isMesh && child.material && !child.name.includes('outline')) {
                child.material.color.setHex(colorHex);
            }
        });
    },

    updateOutlineColor() {
        if (!this.selectedObject) return;

        this.saveState();

        const color = $('#prop-outline-color').val();
        const colorHex = parseInt(color.replace('#', '0x'));

        this.selectedObject.userData.outlineColor = colorHex;

        // Update outline colors
        this.selectedObject.traverse(child => {
            if (child.isLine && child.material) {
                child.material.color.setHex(colorHex);
            }
        });
    },

    updateSelectedObjectProperty(prop, value) {
        if (!this.selectedObject) return;
        this.saveState();
        this.selectedObject.userData[prop] = value;
    },

    updateAGVProperties() {
        if (!this.selectedObject || this.selectedObject.userData.type !== 'agv') return;

        this.saveState();

        const data = this.selectedObject.userData;
        data.capacity = parseFloat($('#prop-agv-capacity').val()) || 500;
        data.maxSpeed = parseFloat($('#prop-agv-speed').val()) || 1.5;
        data.battery = parseFloat($('#prop-agv-battery').val()) || 100;
        data.status = $('#prop-agv-status').val();

        // Update status light
        ObjectFactory.updateAGVStatus(this.selectedObject, data.status);
    },

    rebuildSelectedShelf() {
        if (!this.selectedObject || this.selectedObject.userData.type !== 'shelf') return;

        this.saveState();

        const oldData = this.selectedObject.userData;
        const position = this.selectedObject.position.clone();
        const rotation = this.selectedObject.rotation.y;

        // Get new values
        const newData = {
            ...oldData,
            shelfWidth: parseInt($('#prop-shelf-width').val()) || 1,
            shelfDepth: parseInt($('#prop-shelf-depth').val()) || 4,
            shelfLevels: parseInt($('#prop-shelf-levels').val()) || 5,
            position: { x: position.x, y: 0, z: position.z },
            rotation: rotation
        };

        // Remove old object
        Scene.removeObject(this.selectedObject);

        // Create new object
        const newObj = ObjectFactory.createObject('shelf', newData);
        Scene.addObject(newObj, 'shelf');

        // Select new object
        this.selectObject(newObj);
    },

    rebuildSelectedEquipment() {
        if (!this.selectedObject || this.selectedObject.userData.type !== 'equipment') return;

        this.saveState();

        const oldData = this.selectedObject.userData;
        const position = this.selectedObject.position.clone();
        const rotation = this.selectedObject.rotation.y;

        const shape = $('#prop-equip-shape').val();

        const newData = {
            ...oldData,
            shape: shape,
            equipHeight: parseFloat($('#prop-equip-height').val()) || 2.1,
            position: { x: position.x, y: 0, z: position.z },
            rotation: rotation
        };

        if (shape === 'cylinder') {
            newData.equipDiameter = parseFloat($('#prop-equip-diameter').val()) || 0.6;
        } else {
            newData.equipLength = parseFloat($('#prop-equip-length').val()) || 0.6;
            newData.equipWidth = parseFloat($('#prop-equip-width').val()) || 0.6;
        }

        // Remove old object
        Scene.removeObject(this.selectedObject);

        // Create new object
        const newObj = ObjectFactory.createObject('equipment', newData);
        Scene.addObject(newObj, 'equipment');

        // Select new object
        this.selectObject(newObj);
    },

    deleteSelectedObject() {
        if (!this.selectedObject) return;

        this.saveState();

        // Update AGV count
        if (this.selectedObject.userData.type === 'agv') {
            this.agvCount--;
        }

        Scene.removeObject(this.selectedObject);
        this.deselectObject();

        App.showToast('物件已刪除', 'success');
    },

    countExistingAGVs() {
        this.agvCount = 0;
        if (Scene.layerGroups && Scene.layerGroups.agv) {
            Scene.layerGroups.agv.children.forEach(child => {
                if (child.userData && child.userData.type === 'agv') {
                    this.agvCount++;
                }
            });
        }
    },

    // Undo/Redo System
    saveState() {
        // Get current scene state
        const state = Scene.getSceneData();

        // Remove future states if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Add new state
        this.history.push(JSON.stringify(state));

        // Limit history size
        if (this.history.length > this.maxHistorySteps) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.updateHistoryButtons();
    },

    undo() {
        if (this.historyIndex <= 0) return;

        this.historyIndex--;
        this.restoreState(JSON.parse(this.history[this.historyIndex]));
        this.updateHistoryButtons();
        App.showToast('已復原', 'info');
    },

    redo() {
        if (this.historyIndex >= this.history.length - 1) return;

        this.historyIndex++;
        this.restoreState(JSON.parse(this.history[this.historyIndex]));
        this.updateHistoryButtons();
        App.showToast('已重做', 'info');
    },

    restoreState(state) {
        // Clear current scene
        Scene.clearScene();

        // Recreate floor
        if (App.currentLayout) {
            Scene.createFloor(App.currentLayout.width, App.currentLayout.depth);
            Scene.createWalls(App.currentLayout.width, App.currentLayout.depth, App.currentLayout.height);
        }

        // Restore objects
        state.objects.forEach(objData => {
            const obj = ObjectFactory.createObject(objData.type, objData);
            if (obj) {
                Scene.addObject(obj, objData.layer || objData.type);
            }
        });

        // Restore paths
        state.paths.forEach(pathData => {
            Scene.createPath(pathData);
        });

        // Deselect
        this.deselectObject();

        // Update AGV count
        this.countExistingAGVs();
    },

    updateHistoryButtons() {
        $('#btn-undo').prop('disabled', this.historyIndex <= 0);
        $('#btn-redo').prop('disabled', this.historyIndex >= this.history.length - 1);
    },

    // Save layout to storage
    saveLayout() {
        if (!App.currentLayout) return;

        const sceneData = Scene.getSceneData();

        // Capture preview
        const preview = Scene.capturePreview();

        App.updateCurrentLayout({
            objects: sceneData.objects,
            paths: sceneData.paths,
            preview: preview
        });

        App.showToast('布局已儲存', 'success');
    }
};
