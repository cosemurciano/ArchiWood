# Wood House Designer

WordPress plugin that powers an interactive Konva.js canvas to design custom wooden houses. It includes a configurable grid, base geometric primitives, export tooling and a ready-to-use page template.

## Plugin Setup

1. Copy the `wood-house-designer` directory into your WordPress installation under `wp-content/plugins/`.
2. Activate **Wood House Designer** from the WordPress Plugins page.
3. Configure the default grid size, scale ratio and canvas size from **Settings → Wood House Designer**.
4. Create a page and either:
   - Insert the `[wood_house_designer]` shortcode in the content, or
   - Assign the **Wood House Designer App** page template to render the full application layout.

## Features

- Konva.js powered design surface with snap grid and real scale guides.
- Toolbox with draggable wall, window, beam and dimension label primitives.
- Export button that generates a JSON package with project metadata and scene data.
- Accessible layout with dedicated header, tools panel, canvas and status bar regions.

## Development

Assets live under `wood-house-designer/assets/css` and `wood-house-designer/assets/js`. The plugin bootstrap file is `wood-house-designer/wood-house-designer.php`.
