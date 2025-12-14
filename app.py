"""
WiseDigitalTwins - Flask Backend
Warehouse Digital Twin Platform API
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
import uuid

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Data storage directory
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
LAYOUTS_FILE = os.path.join(DATA_DIR, 'layouts.json')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)


def load_layouts():
    """Load layouts from JSON file"""
    if os.path.exists(LAYOUTS_FILE):
        try:
            with open(LAYOUTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_layouts(layouts):
    """Save layouts to JSON file"""
    with open(LAYOUTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(layouts, f, ensure_ascii=False, indent=2)


# Serve static files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)


@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)


@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)


# API Routes

@app.route('/api/layouts', methods=['GET'])
def get_layouts():
    """Get all layouts"""
    layouts = load_layouts()
    # Return layouts without full object data for listing
    return jsonify([{
        'id': l['id'],
        'name': l['name'],
        'width': l['width'],
        'depth': l['depth'],
        'height': l['height'],
        'objectCount': len(l.get('objects', [])),
        'createdAt': l.get('createdAt'),
        'updatedAt': l.get('updatedAt'),
        'preview': l.get('preview')
    } for l in layouts])


@app.route('/api/layouts', methods=['POST'])
def create_layout():
    """Create a new layout"""
    data = request.get_json()

    layout = {
        'id': str(uuid.uuid4()),
        'name': data.get('name', '新布局'),
        'width': data.get('width', 60),
        'depth': data.get('depth', 60),
        'height': data.get('height', 5),
        'gridSize': data.get('gridSize', 0.6),
        'objects': [],
        'paths': [],
        'createdAt': datetime.utcnow().isoformat(),
        'updatedAt': datetime.utcnow().isoformat(),
        'preview': None
    }

    layouts = load_layouts()
    layouts.append(layout)
    save_layouts(layouts)

    return jsonify(layout), 201


@app.route('/api/layouts/<layout_id>', methods=['GET'])
def get_layout(layout_id):
    """Get a specific layout by ID"""
    layouts = load_layouts()
    layout = next((l for l in layouts if l['id'] == layout_id), None)

    if layout is None:
        return jsonify({'error': 'Layout not found'}), 404

    return jsonify(layout)


@app.route('/api/layouts/<layout_id>', methods=['PUT'])
def update_layout(layout_id):
    """Update a layout"""
    data = request.get_json()
    layouts = load_layouts()

    layout_index = next((i for i, l in enumerate(layouts) if l['id'] == layout_id), None)

    if layout_index is None:
        return jsonify({'error': 'Layout not found'}), 404

    # Update layout fields
    layout = layouts[layout_index]
    layout['name'] = data.get('name', layout['name'])
    layout['width'] = data.get('width', layout['width'])
    layout['depth'] = data.get('depth', layout['depth'])
    layout['height'] = data.get('height', layout['height'])
    layout['objects'] = data.get('objects', layout.get('objects', []))
    layout['paths'] = data.get('paths', layout.get('paths', []))
    layout['preview'] = data.get('preview', layout.get('preview'))
    layout['updatedAt'] = datetime.utcnow().isoformat()

    save_layouts(layouts)

    return jsonify(layout)


@app.route('/api/layouts/<layout_id>', methods=['DELETE'])
def delete_layout(layout_id):
    """Delete a layout"""
    layouts = load_layouts()
    layouts = [l for l in layouts if l['id'] != layout_id]
    save_layouts(layouts)

    return jsonify({'success': True})


@app.route('/api/layouts/<layout_id>/objects', methods=['GET'])
def get_layout_objects(layout_id):
    """Get all objects in a layout"""
    layouts = load_layouts()
    layout = next((l for l in layouts if l['id'] == layout_id), None)

    if layout is None:
        return jsonify({'error': 'Layout not found'}), 404

    return jsonify(layout.get('objects', []))


@app.route('/api/layouts/<layout_id>/objects', methods=['POST'])
def add_object(layout_id):
    """Add an object to a layout"""
    data = request.get_json()
    layouts = load_layouts()

    layout_index = next((i for i, l in enumerate(layouts) if l['id'] == layout_id), None)

    if layout_index is None:
        return jsonify({'error': 'Layout not found'}), 404

    obj = {
        'id': str(uuid.uuid4()),
        **data
    }

    if 'objects' not in layouts[layout_index]:
        layouts[layout_index]['objects'] = []

    layouts[layout_index]['objects'].append(obj)
    layouts[layout_index]['updatedAt'] = datetime.utcnow().isoformat()
    save_layouts(layouts)

    return jsonify(obj), 201


@app.route('/api/layouts/<layout_id>/objects/<object_id>', methods=['PUT'])
def update_object(layout_id, object_id):
    """Update an object in a layout"""
    data = request.get_json()
    layouts = load_layouts()

    layout_index = next((i for i, l in enumerate(layouts) if l['id'] == layout_id), None)

    if layout_index is None:
        return jsonify({'error': 'Layout not found'}), 404

    objects = layouts[layout_index].get('objects', [])
    obj_index = next((i for i, o in enumerate(objects) if o.get('id') == object_id), None)

    if obj_index is None:
        return jsonify({'error': 'Object not found'}), 404

    objects[obj_index] = {**objects[obj_index], **data}
    layouts[layout_index]['updatedAt'] = datetime.utcnow().isoformat()
    save_layouts(layouts)

    return jsonify(objects[obj_index])


@app.route('/api/layouts/<layout_id>/objects/<object_id>', methods=['DELETE'])
def delete_object(layout_id, object_id):
    """Delete an object from a layout"""
    layouts = load_layouts()

    layout_index = next((i for i, l in enumerate(layouts) if l['id'] == layout_id), None)

    if layout_index is None:
        return jsonify({'error': 'Layout not found'}), 404

    layouts[layout_index]['objects'] = [
        o for o in layouts[layout_index].get('objects', [])
        if o.get('id') != object_id
    ]
    layouts[layout_index]['updatedAt'] = datetime.utcnow().isoformat()
    save_layouts(layouts)

    return jsonify({'success': True})


@app.route('/api/layouts/<layout_id>/paths', methods=['GET'])
def get_layout_paths(layout_id):
    """Get all AGV paths in a layout"""
    layouts = load_layouts()
    layout = next((l for l in layouts if l['id'] == layout_id), None)

    if layout is None:
        return jsonify({'error': 'Layout not found'}), 404

    return jsonify(layout.get('paths', []))


@app.route('/api/layouts/<layout_id>/paths', methods=['POST'])
def add_path(layout_id):
    """Add an AGV path to a layout"""
    data = request.get_json()
    layouts = load_layouts()

    layout_index = next((i for i, l in enumerate(layouts) if l['id'] == layout_id), None)

    if layout_index is None:
        return jsonify({'error': 'Layout not found'}), 404

    path = {
        'id': str(uuid.uuid4()),
        **data
    }

    if 'paths' not in layouts[layout_index]:
        layouts[layout_index]['paths'] = []

    layouts[layout_index]['paths'].append(path)
    layouts[layout_index]['updatedAt'] = datetime.utcnow().isoformat()
    save_layouts(layouts)

    return jsonify(path), 201


@app.route('/api/layouts/<layout_id>/paths/<path_id>', methods=['DELETE'])
def delete_path(layout_id, path_id):
    """Delete an AGV path from a layout"""
    layouts = load_layouts()

    layout_index = next((i for i, l in enumerate(layouts) if l['id'] == layout_id), None)

    if layout_index is None:
        return jsonify({'error': 'Layout not found'}), 404

    layouts[layout_index]['paths'] = [
        p for p in layouts[layout_index].get('paths', [])
        if p.get('id') != path_id
    ]
    layouts[layout_index]['updatedAt'] = datetime.utcnow().isoformat()
    save_layouts(layouts)

    return jsonify({'success': True})


# AGV Simulation API (for future integration)

@app.route('/api/simulation/agvs', methods=['GET'])
def get_agvs_status():
    """Get current status of all AGVs (mock data for demo)"""
    # This would integrate with actual AGV management system
    return jsonify([
        {
            'id': 'AGV-001',
            'status': 'working',
            'battery': 85,
            'position': {'x': 10.5, 'z': 15.2},
            'currentTask': '前往貨架 A-03 取貨',
            'hasCargo': False
        },
        {
            'id': 'AGV-002',
            'status': 'idle',
            'battery': 92,
            'position': {'x': 5.0, 'z': 8.0},
            'currentTask': None,
            'hasCargo': False
        }
    ])


@app.route('/api/simulation/tasks', methods=['GET'])
def get_tasks():
    """Get pending tasks (mock data for demo)"""
    return jsonify([
        {
            'id': 'TASK-001',
            'type': '取貨',
            'target': '貨架 A-03',
            'priority': 'high',
            'status': 'pending'
        },
        {
            'id': 'TASK-002',
            'type': '送貨',
            'target': '出貨站 B-01',
            'priority': 'normal',
            'status': 'in_progress'
        }
    ])


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })


if __name__ == '__main__':
    print("=" * 50)
    print("WiseDigitalTwins - 智能倉儲數字孿生平台")
    print("=" * 50)
    print("\n啟動伺服器...")
    print("請在瀏覽器開啟: http://localhost:8080")
    print("\n按 Ctrl+C 停止伺服器\n")
    app.run(debug=True, host='0.0.0.0', port=8080)
