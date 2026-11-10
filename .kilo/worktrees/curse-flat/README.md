# Pixel 3D - Pro Staging Studio

> A powerful browser-based 3D modeling and staging application with AI-powered scene generation capabilities.

![Pixel 3D Hero Screenshot](./screenshots/hero-screenshot.png)
*[Replace with actual hero screenshot showing the main application interface]*

## 🌟 Features

### 🎨 3D Scene Creation
- **Professional 3D Modeling**: Create complex 3D scenes directly in your browser
- **Primitive Shapes**: Comprehensive set of 3D primitives (Box, Sphere, Cone, Cylinder, Plane, Torus, Tetrahedron, Octahedron, Dodecahedron, Icosahedron, Torus Knot)
- **Advanced Lighting**: Multiple light types including Point, Spot, Directional, Ambient, and Hemisphere lighting
- **Real-time Rendering**: Powered by Three.js with high-performance WebGL rendering

### 🤖 AI-Powered Scene Generation
- **Magic Scene Generator**: Describe your scene in natural language and let AI create it
- **Gemini Integration**: Uses Google's Gemini AI for intelligent scene generation
- **Smart Object Placement**: AI automatically positions and colors objects based on your description

### 👥 Character Animation
- **Animated Characters**: Support for Xbot (female) and Ybot (male) characters
- **GLTF Support**: Full compatibility with GLTF 3D models
- **Animation Blending**: Smooth transitions between idle, walk, and run animations
- **Real-time Animation**: Character animations update in real-time

### 🎞️ Animation System
- **Keyframe Animations**: Create smooth animations for any object in the scene
- **Timeline Interface**: Visual timeline for editing keyframes and animation curves
- **Playback Controls**: Play, pause, stop, loop, and speed controls
- **Easing Functions**: Multiple easing options for natural motion
- **Property Animation**: Animate position, rotation, and scale independently

### 🎯 Professional Tools
- **Transform Controls**: Move, rotate, and scale objects with precision
- **Layer Management**: Organize objects in folders for better scene organization
- **Materials System**: Comprehensive material editor with color management
- **History Management**: Full undo/redo functionality for all actions

### 📸 Export & Production
- **JavaScript Export (.js)**: Export scenes as standalone JavaScript functions re-creatable in any Three.js project
- **Named `initSceneN` Functions**: Each exported scene is wrapped in a `window.initScene1(group)` call; call `window.initAllScenes(group)` to apply all at once
- **Material Name Preservation**: Named materials resolve through `mesh.material.name → userData.materialName → semantic hex-name` so `const matWood`, `const matDark`, etc. appear in the generated output
- **High-Resolution PNG Export**: Export scenes as PNG with customizable resolution
- **Multiple Resolutions**: Preset sizes from 24×24 game icons up to 4K (3840×2160)
- **Custom Resolutions**: Set any width and height for exports
- **Camera Border Preview**: Draggable overlay preview of the export frame
- **Transparent Background**: Optional checkbox for compositing exports

### ⚙️ Advanced Settings
- **Grid & Axes**: Toggle grid and axes helpers for precise positioning
- **Snap to Grid**: Optional grid snapping for accurate placement
- **Camera Controls**: Adjustable camera speed and movement sensitivity
- **Autosave**: Automatic scene saving with customizable intervals
- **Performance Tuning**: High-performance WebGL settings optimized for smooth rendering

### 💾 File Management
- **Browser Storage**: Save scenes directly to your browser
- **JSON Import/Export**: Full scene serialization and loading with `materialName` round-trip
- **GLB Export**: Binary GLTF model export compatible with major 3D tools
- **JavaScript Export (.js)**: Export scenes as `window.initSceneN` functions for use in external code

## 🚀 Quick Start

### Installation
1. Clone or download the repository
2. On macOS, double-click `start.command`
3. Pixel3D opens at `http://localhost:4173`

Pixel3D uses JavaScript modules, so `index.html` cannot be opened directly with
a `file://` URL. If the launcher is unavailable, run this from the project
folder and then visit `http://localhost:4173`:

```sh
python3 -m http.server 4173
```

No package installation is required.

### First Scene
1. **Add Objects**: Click the shapes menu to add basic 3D shapes
2. **Select & Transform**: Use transform tools to move, rotate, and scale objects
3. **Add Lighting**: Use the lights menu to illuminate your scene
4. **Generate with AI**: Try the Magic Scene Generator for AI-assisted scene creation
5. **Export**: Export scenes as JS for use in any Three.js project, or as PNG for image production

### JavaScript Export (.js)
Settings → **Export Format** → `JS (.js)` → click **Export**.

![Quick Start Demo](./demos/quick-start-demo.gif)
*[Replace with actual demo video showing basic scene creation]*

## 📖 User Guide

### Interface Overview

![Interface Overview](./screenshots/interface-overview.png)
*[Replace with annotated screenshot showing all interface elements]*

#### Header Bar
- **Logo**: Pixel 3D branding with version indicator
- **Undo/Redo**: History navigation controls
- **File Operations**: Clear, Load, Save to Browser, Export

#### Left Toolbar
- **Selection Tool**: Click to select objects (Keyboard: Q)
- **AI Scene Generator**: Magic wand icon for AI-powered scene creation
- **Shapes Menu**: Comprehensive primitive shape tools
- **Characters Menu**: Animated character models
- **Lights Menu**: Various lighting options
- **Materials Tool**: Material editor and manager
- **Scene Settings**: Export and scene configuration
- **Settings**: Application preferences

#### Canvas Area
- **3D Viewport**: Real-time 3D scene rendering
- **Transform Controls**: Move, rotate, scale buttons
- **Zoom Controls**: Zoom slider and controls
- **Grid & Axes**: Visual helpers for positioning

#### Right Panel
- **Scene Objects**: Layer manager and object list
- **Properties**: Object-specific property editor
- **Materials**: Material management section
- **Scene Export**: Export settings and preview

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Select Tool |
| `H` | Hand Tool (Pan/Rotate View) |
| `G` | Translate Mode (Move objects) |
| `R` | Rotate Mode |
| `S` | Scale Mode |
| `X` | Delete Selected Object |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+Shift+O` | Toggle Overlays |
| `+/-` | Zoom In/Out |

### AI Scene Generation

![AI Scene Generator](./demos/ai-scene-generation.gif)
*[Replace with demo video showing AI scene generation]*

1. Click the Magic Wand icon in the toolbar
2. Enter a description of your desired scene
3. Click "Generate ✨" and watch AI create your scene
4. Example prompts:
   - "A circle of blue boxes with a red sphere in the middle"
   - "A futuristic city with tall buildings and flying cars"
   - "A peaceful forest with trees, rocks, and a small pond"

### Character Animation

![Character Animation](./demos/character-animation.gif)
*[Replace with demo video showing character loading and animation]*

1. Access the Characters menu in the left toolbar
2. Select Xbot (female) or Ybot (male) character
3. Characters automatically animate with idle, walk, and run cycles
4. Use transform controls to position and scale characters

### Exporting Scenes

![Export Process](./demos/export-process.gif)
*[Replace with demo video showing the export process]*

1. Open the Scene Export section in the right panel
2. Configure export settings:
   - Canvas size (width/height)
   - Show/Hide camera border
   - Background transparency
3. Click "Export as PNG" to save your scene
4. Choose from preset resolutions or set custom dimensions

### JavaScript Export (.js)

Generate a self-contained script that re-creates your scene inside any Three.js app:

```js
// Inside your own Three.js app, create a Three.Group and pass it to the function:
window.initScene1(group);      // add the first scene to group
window.initAllScenes(group);   // add ALL scenes sequentially

// Example:
const group = new THREE.Group();
scene.add(group);
window.initAllScenes(group);
```

Each exported file contains one `window.initSceneN` function per named group and a master `window.initAllScenes` that calls them in order — materials are declared inside each function so they are local and never leak into yours:

```js
// Scene 1 — Ship (downloads as scene.js)
window.initScene1 = function(group) {
    const matWood = new THREE.MeshPhongMaterial({ color: 0x8b5e2f, transparent: true, opacity: 0 });
    const matDark = new THREE.MeshPhongMaterial({ color: 0x5c3a1a, transparent: true, opacity: 0 });

    const keel = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 0.5), matDark);
    keel.position.set(0, 2, 0);
    group.add(keel);
};
```

#### Material Name Preservation
The exported function names are resolved from three sources, in priority order:
1. **`mesh.material.name`** — set by MaterialsManager → `Apply to Selected`
2. **`mesh.userData.materialName`** — written at shape creation and during JSON load
3. **`semanticColorName(hex_int)`** — built-in hex lookup (e.g. `0x8B5E2F` → `matWood`, `0x5C3A1A` → `matDark`)

JSON import/export also persists `materialName` so round-tripping keeps your material names intact.

## 🎯 Use Cases

### Content Creation
- **Social Media**: Create eye-catching 3D images for posts
- **Marketing**: Generate product visualizations and scene mockups
- **Presentations**: Design 3D backgrounds and visual elements

### Design & Prototyping
- **Product Visualization**: Prototype 3D product designs
- **Architecture**: Create preliminary architectural visualizations
- **Game Development**: Rapid prototyping for 3D game scenes
- **Code Portability**: Export scenes as JavaScript (.js) to re-create in any Three.js pipeline

### Education & Learning
- **3D Modeling Education**: Learn 3D concepts in a browser
- **Scene Composition**: Study lighting, materials, and composition
- **AI Collaboration**: Explore AI-assisted creative workflows

## 🛠️ Technical Details

### Technology Stack
- **3D Engine**: Three.js WebGL
- **AI Integration**: Google Gemini API
- **Character Models**: GLTF format support
- **Storage**: Browser Local Storage
- **Export**: PNG, JSON, GLB, and JS (initSceneN functions)
- **Architecture**: Modular ES6 JavaScript classes

### Performance
- **WebGL Acceleration**: Hardware-accelerated 3D rendering
- **Optimized Materials**: Efficient material and lighting systems
- **Smart Caching**: Character models cached for smooth animation
- **Responsive Design**: Optimized for various screen sizes

### Browser Compatibility
- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Mobile**: Limited support (desktop recommended)

## 📁 Project Structure

```
pixel3d-main/
├── index.html              # Main application entry point
├── css/
│   ├── styles.css          # Complete application styling
│   ├── settings.css        # Settings modal styling
│   ├── modal.css           # Modal styling
│   ├── tutorials.css       # Tutorial styling
│   └── animation.css       # Animation timeline panel styling
├── js/
│   ├── main.js             # Application bootstrap and core logic
│   ├── ui.js               # User interface management
│   ├── factory.js          # 3D object creation factory
│   ├── gemini.js           # AI scene generation
│   ├── characterManager.js # Character animation system
│   ├── materialsManager.js # Material editing system
│   ├── layerManager.js     # Scene organization
│   ├── cameraManager.js    # Camera control system
│   ├── historyManager.js   # Undo/redo functionality
│   ├── fileManager.js      # Save/load system
│   ├── tooltip.js          # Help tooltips
│   ├── config.js           # Application configuration
│   ├── animationManager.js # Keyframe animation system
│   └── animationUI.js      # Timeline panel controller
├── Art/
│   ├── Xbot.blend          # Blender source for female character
│   ├── Xbot.glb            # GLTF female character model
│   ├── Ybot.blend          # Blender source for male character
│   └── Ybot.glb            # GLTF male character model
├── fonts/
│   └── inter-normal.woff2  # Inter font family
├── docs/                   # Documentation and test files
└── screenshots/            # Application screenshots
```

## 🎨 Customization

### Adding New Shapes
1. Extend the `ObjectFactory` class in `js/factory.js`
2. Add shape creation logic
3. Update the shapes menu in `index.html`
4. Implement selection and transform handling

### AI Prompts
Customize AI behavior by modifying the system prompts in `js/gemini.js`:
- Scene generation prompts
- Material color generation
- Object placement logic

### Materials
Extend the materials system by:
- Adding new material types in `js/materialsManager.js`
- Implementing custom shaders
- Creating material presets

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the Repository**: Create your own copy
2. **Feature Branch**: Create a branch for your feature
3. **Code Standards**: Follow existing code patterns
4. **Testing**: Test your changes thoroughly
5. **Pull Request**: Submit your changes for review

### Development Setup
1. Clone the repository
2. Open `index.html` in a local web server
3. Enable browser developer tools for debugging
4. Make changes and test in multiple browsers

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Three.js Community**: For the amazing 3D WebGL framework
- **Google Gemini**: For AI-powered scene generation
- **Mixamo**: For providing high-quality character models
- **Inter Font**: For the beautiful typography
- **Font Awesome**: For the comprehensive icon set

## 📞 Support

- **Documentation**: Check this README and inline tooltips
- **Issues**: Report bugs and feature requests on GitHub
- **Community**: Join discussions and share your creations

---

**Pixel 3D - Pro Staging Studio** - Creating the future of browser-based 3D design, one pixel at a time. 🚀

![Pixel 3D Logo](./branding/pixel3d-logo.png)
*[Replace with actual application logo]*
