<?php
/**
 * Plugin Name: Wood House Designer
 * Description: Configurable interactive wood house design tool with Konva.js integration.
 * Version: 1.0.0
 * Author: ArchiWood Team
 * Text Domain: wood-house-designer
 * Domain Path: /languages
 * Update URI: https://github.com/ArchiWood/ArchiWood
 */

defined( 'ABSPATH' ) || exit;

define( 'WOOD_HOUSE_DESIGNER_VERSION', '1.0.0' );
define( 'WOOD_HOUSE_DESIGNER_PATH', plugin_dir_path( __FILE__ ) );
define( 'WOOD_HOUSE_DESIGNER_URL', plugin_dir_url( __FILE__ ) );
define( 'WOOD_HOUSE_DESIGNER_BASENAME', plugin_basename( __FILE__ ) );

require_once WOOD_HOUSE_DESIGNER_PATH . 'includes/class-wood-house-designer.php';
require_once WOOD_HOUSE_DESIGNER_PATH . 'includes/class-wood-house-designer-settings.php';
require_once WOOD_HOUSE_DESIGNER_PATH . 'includes/class-wood-house-designer-template-loader.php';
require_once WOOD_HOUSE_DESIGNER_PATH . 'includes/class-wood-house-designer-github-updater.php';

Wood_House_Designer::instance();
Wood_House_Designer_Settings::instance();
Wood_House_Designer_Template_Loader::instance();
Wood_House_Designer_GitHub_Updater::instance();
