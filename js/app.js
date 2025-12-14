/**
 * WiseDigitalTwins - Main Application
 * Warehouse Digital Twin Platform
 */

// Global Application State
const App = {
    currentPage: 'home',
    currentLayout: null,
    layouts: [],
    isSimulationMode: false,

    // Initialize the application
    init() {
        this.loadLayouts();
        this.bindEvents();
        this.renderLayoutList();
        this.showPage('home');
    },

    // Load layouts from localStorage
    loadLayouts() {
        const saved = localStorage.getItem('wdt_layouts');
        if (saved) {
            this.layouts = JSON.parse(saved);
        }
    },

    // Save layouts to localStorage
    saveLayouts() {
        localStorage.setItem('wdt_layouts', JSON.stringify(this.layouts));
    },

    // Bind event handlers
    bindEvents() {
        // Navigation
        $('.nav-link').on('click', (e) => {
            e.preventDefault();
            const page = $(e.currentTarget).data('page');
            if (page === 'editor' && !this.currentLayout) {
                this.showToast('請先選擇或建立一個布局', 'error');
                return;
            }
            this.showPage(page);
        });

        // New Layout Modal
        $('#btn-new-layout').on('click', () => this.showModal('new-layout-modal'));
        $('.modal-close, .modal-cancel').on('click', () => this.hideAllModals());
        $('#btn-create-layout').on('click', () => this.createLayout());

        // Back to home
        $('#btn-back-home').on('click', () => {
            this.showPage('home');
            this.renderLayoutList();
        });

        // Save button
        $('#btn-save').on('click', () => {
            if (window.Editor) {
                Editor.saveLayout();
            }
        });

        // Mode toggle
        $('.mode-btn').on('click', (e) => {
            const mode = $(e.currentTarget).data('mode');
            this.setMode(mode);
        });

        // Panel toggles
        $('.panel-toggle').on('click', (e) => {
            const panel = $(e.currentTarget).data('panel');
            this.togglePanel(panel);
        });

        // View controls
        $('.view-btn').on('click', (e) => {
            const view = $(e.currentTarget).data('view');
            if (window.Scene) {
                Scene.setView(view);
            }
            $('.view-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
        });

        // Zoom controls
        $('#zoom-in').on('click', () => window.Scene && Scene.zoom(1.2));
        $('#zoom-out').on('click', () => window.Scene && Scene.zoom(0.8));
        $('#zoom-fit').on('click', () => window.Scene && Scene.fitToView());

        // Undo/Redo
        $('#btn-undo').on('click', () => window.Editor && Editor.undo());
        $('#btn-redo').on('click', () => window.Editor && Editor.redo());

        // Keyboard shortcuts
        $(document).on('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        window.Editor && Editor.redo();
                    } else {
                        window.Editor && Editor.undo();
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    window.Editor && Editor.redo();
                } else if (e.key === 's') {
                    e.preventDefault();
                    window.Editor && Editor.saveLayout();
                }
            }
            // Delete selected object
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (window.Editor && Editor.selectedObject && this.currentPage === 'editor') {
                    e.preventDefault();
                    Editor.deleteSelectedObject();
                }
            }
        });

        // Layer visibility
        $('.layer-dropdown-content input').on('change', (e) => {
            const layer = $(e.currentTarget).data('layer');
            const visible = e.currentTarget.checked;
            if (window.Scene) {
                Scene.setLayerVisibility(layer, visible);
            }
        });

        // Hidden layer display mode
        $('#hidden-layer-mode').on('change', (e) => {
            if (window.Scene) {
                Scene.setHiddenLayerMode(e.target.value);
            }
        });

        // Close modals on backdrop click
        $('.modal').on('click', (e) => {
            if ($(e.target).hasClass('modal')) {
                this.hideAllModals();
            }
        });

        // Equipment shape toggle in modal
        $('#new-equip-shape').on('change', (e) => {
            if (e.target.value === 'cylinder') {
                $('.new-box-dims').hide();
                $('.new-cylinder-dims').show();
            } else {
                $('.new-box-dims').show();
                $('.new-cylinder-dims').hide();
            }
        });
    },

    // Show a specific page
    showPage(page) {
        this.currentPage = page;
        $('.page').removeClass('active');
        $(`#${page}-page`).addClass('active');
        $('.nav-link').removeClass('active');
        $(`.nav-link[data-page="${page}"]`).addClass('active');

        if (page === 'editor' && this.currentLayout) {
            // Initialize editor with current layout
            setTimeout(() => {
                if (window.Scene) {
                    Scene.init();
                    Scene.loadLayout(this.currentLayout);
                }
                if (window.Editor) {
                    Editor.init();
                }
            }, 100);
        }
    },

    // Set edit/simulate mode
    setMode(mode) {
        this.isSimulationMode = mode === 'simulate';
        $('.mode-btn').removeClass('active');
        $(`.mode-btn[data-mode="${mode}"]`).addClass('active');

        if (this.isSimulationMode) {
            // Hide left panel, show simulation controls
            $('#left-panel').addClass('collapsed');
            $('.simulation-controls').show();
            $('.layer-display-mode').show();
            $('.history-controls').hide();
            // Show AGV simulation properties
            $('.agv-simulation-props').show();
            // Initialize simulation
            if (window.Simulation) {
                Simulation.init();
            }
        } else {
            // Show left panel, hide simulation controls
            $('#left-panel').removeClass('collapsed');
            $('.simulation-controls').hide();
            $('.layer-display-mode').hide();
            $('.history-controls').show();
            $('.agv-simulation-props').hide();
            // Stop simulation
            if (window.Simulation) {
                Simulation.stop();
            }
        }
    },

    // Toggle panel visibility
    togglePanel(panel) {
        const $panel = $(`#${panel}-panel`);
        $panel.toggleClass('collapsed');

        const $toggle = $panel.find('.panel-toggle');
        if ($panel.hasClass('collapsed')) {
            $toggle.text(panel === 'left' ? '▶' : '◀');
        } else {
            $toggle.text(panel === 'left' ? '◀' : '▶');
        }

        // Trigger resize for Three.js
        setTimeout(() => {
            if (window.Scene) {
                Scene.onWindowResize();
            }
        }, 300);
    },

    // Show modal
    showModal(modalId) {
        $(`#${modalId}`).addClass('active');
    },

    // Hide all modals
    hideAllModals() {
        $('.modal').removeClass('active');
    },

    // Create new layout
    createLayout() {
        const name = $('#layout-name').val().trim() || '新布局';
        const width = parseFloat($('#layout-width').val()) || 60;
        const depth = parseFloat($('#layout-depth').val()) || 60;
        const height = parseFloat($('#layout-height').val()) || 5;

        const layout = {
            id: Date.now().toString(),
            name: name,
            width: width,
            depth: depth,
            height: height,
            gridSize: 0.6, // 60cm grid
            objects: [],
            paths: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            preview: null
        };

        this.layouts.push(layout);
        this.saveLayouts();
        this.hideAllModals();
        this.currentLayout = layout;
        this.showPage('editor');
        this.showToast('布局建立成功', 'success');
    },

    // Edit existing layout
    editLayout(layoutId) {
        const layout = this.layouts.find(l => l.id === layoutId);
        if (layout) {
            this.currentLayout = layout;
            this.showPage('editor');
        }
    },

    // Delete layout
    deleteLayout(layoutId) {
        if (confirm('確定要刪除此布局嗎？')) {
            this.layouts = this.layouts.filter(l => l.id !== layoutId);
            this.saveLayouts();
            this.renderLayoutList();
            this.showToast('布局已刪除', 'success');
        }
    },

    // Render layout list on home page
    renderLayoutList() {
        const $list = $('#layout-list');
        $list.empty();

        if (this.layouts.length === 0) {
            $list.html('<p class="no-layouts">尚無布局，請點擊「新增布局」開始</p>');
            return;
        }

        this.layouts.forEach(layout => {
            const card = `
                <div class="layout-card" data-id="${layout.id}">
                    <div class="layout-preview">
                        ${layout.preview
                            ? `<img src="${layout.preview}" alt="${layout.name}">`
                            : '<span class="placeholder">📦</span>'}
                    </div>
                    <div class="layout-info">
                        <h4>${layout.name}</h4>
                        <p>${layout.width}m × ${layout.depth}m × ${layout.height}m</p>
                        <p>物件數: ${layout.objects ? layout.objects.length : 0}</p>
                        <div class="layout-actions">
                            <button class="btn btn-primary btn-edit">編輯</button>
                            <button class="btn btn-danger btn-delete">刪除</button>
                        </div>
                    </div>
                </div>
            `;
            $list.append(card);
        });

        // Bind card events
        $('.layout-card .btn-edit').on('click', (e) => {
            e.stopPropagation();
            const id = $(e.currentTarget).closest('.layout-card').data('id');
            this.editLayout(id);
        });

        $('.layout-card .btn-delete').on('click', (e) => {
            e.stopPropagation();
            const id = $(e.currentTarget).closest('.layout-card').data('id');
            this.deleteLayout(id);
        });
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const $toast = $('#toast');
        $toast.text(message).removeClass('success error').addClass(type).addClass('show');
        setTimeout(() => $toast.removeClass('show'), 3000);
    },

    // Update current layout
    updateCurrentLayout(data) {
        if (this.currentLayout) {
            Object.assign(this.currentLayout, data, {
                updatedAt: new Date().toISOString()
            });

            // Update in layouts array
            const index = this.layouts.findIndex(l => l.id === this.currentLayout.id);
            if (index !== -1) {
                this.layouts[index] = this.currentLayout;
            }

            this.saveLayouts();
        }
    }
};

// Initialize app when document is ready
$(document).ready(() => {
    App.init();
});
