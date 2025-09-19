<?php
/**
 * Core functionality for Wood House Designer.
 *
 * @package WoodHouseDesigner
 */

if ( ! class_exists( 'Wood_House_Designer' ) ) {
    /**
     * Main plugin class.
     */
    class Wood_House_Designer {
        /**
         * Singleton instance.
         *
         * @var Wood_House_Designer
         */
        protected static $instance = null;

        /**
         * Retrieve singleton instance.
         *
         * @return Wood_House_Designer
         */
        public static function instance() {
            if ( null === self::$instance ) {
                self::$instance = new self();
            }

            return self::$instance;
        }

        /**
         * Constructor.
         */
        private function __construct() {
            add_action( 'plugins_loaded', array( $this, 'load_textdomain' ) );
            add_action( 'init', array( $this, 'register_shortcode' ) );
            add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        }

        /**
         * Load plugin translations.
         */
        public function load_textdomain() {
            load_plugin_textdomain( 'wood-house-designer', false, dirname( WOOD_HOUSE_DESIGNER_BASENAME ) . '/languages' );
        }

        /**
         * Register shortcode for app rendering.
         */
        public function register_shortcode() {
            add_shortcode( 'wood_house_designer', array( $this, 'render_app' ) );
        }

        /**
         * Render app container.
         *
         * @return string
         */
        public function render_app() {
            ob_start();
            ?>
            <div id="whd-app-root">
                <div class="whd-app whd-app--loading" data-app-version="<?php echo esc_attr( WOOD_HOUSE_DESIGNER_VERSION ); ?>">
                    <div class="whd-header">
                        <h1 class="whd-header__title"><?php esc_html_e( 'Wood House Designer', 'wood-house-designer' ); ?></h1>
                    </div>
                    <div class="whd-body">
                        <p><?php esc_html_e( 'Loading application…', 'wood-house-designer' ); ?></p>
                    </div>
                </div>
            </div>
            <?php

            return (string) ob_get_clean();
        }

        /**
         * Enqueue scripts and styles.
         */
        public function enqueue_assets() {
            if ( ! $this->should_enqueue() ) {
                return;
            }

            wp_enqueue_style(
                'wood-house-designer',
                WOOD_HOUSE_DESIGNER_URL . 'assets/css/app.css',
                array(),
                WOOD_HOUSE_DESIGNER_VERSION
            );

            wp_enqueue_script(
                'konva',
                'https://unpkg.com/konva@9.3.6/konva.min.js',
                array(),
                '9.3.6',
                true
            );

            wp_enqueue_script(
                'wood-house-designer',
                WOOD_HOUSE_DESIGNER_URL . 'assets/js/app.js',
                array( 'konva', 'wp-element' ),
                WOOD_HOUSE_DESIGNER_VERSION,
                true
            );

            $options = Wood_House_Designer_Settings::instance()->get_options();

            wp_localize_script(
                'wood-house-designer',
                'WoodHouseDesignerConfig',
                array(
                    'gridSize'       => (int) $options['grid_size'],
                    'scaleRatio'     => (float) $options['scale_ratio'],
                    'canvasWidth'    => (int) $options['canvas_width'],
                    'canvasHeight'   => (int) $options['canvas_height'],
                    'exportFileName' => sanitize_file_name( $options['export_file_name'] ),
                    'exportDpi'      => isset( $options['export_dpi'] ) ? (int) $options['export_dpi'] : 150,
                    'casette'        => isset( $options['casette'] ) ? $options['casette'] : array(),
                    'doors'          => isset( $options['doors'] ) ? $options['doors'] : array(),
                    'appVersion'     => WOOD_HOUSE_DESIGNER_VERSION,
                    'strings'        => array(
                        'appTitle'         => esc_html__( 'Wood House Designer', 'wood-house-designer' ),
                        'shapesHeading'    => esc_html__( 'Cottages', 'wood-house-designer' ),
                        'fixturesHeading'  => esc_html__( 'Fixtures', 'wood-house-designer' ),
                        'actionsHeading'   => esc_html__( 'Actions', 'wood-house-designer' ),
                        'exportButton'     => esc_html__( 'Export PNG', 'wood-house-designer' ),
                        'ready'            => esc_html__( 'Ready. Use the toolbox to add elements.', 'wood-house-designer' ),
                        'exportSuccess'    => esc_html__( 'Project exported successfully.', 'wood-house-designer' ),
                        'exportUnavailable'=> esc_html__( 'Unable to export the project right now.', 'wood-house-designer' ),
                        'errorKonva'       => esc_html__( 'The drawing library is not available. Please refresh the page.', 'wood-house-designer' ),
                        'cursorStatus'     => esc_html__( 'Cursor: %x% × %y% m', 'wood-house-designer' ),
                        'selectedStatus'   => esc_html__( 'Selected %name% - %width%m × %depth%m × %height%m', 'wood-house-designer' ),
                        'cottageLabel'     => esc_html__( 'Cottage %width%m × %depth%m × %height%m', 'wood-house-designer' ),
                        'noCottages'       => esc_html__( 'No cottages configured yet.', 'wood-house-designer' ),
                        'designCanvas'     => esc_html__( 'Design Canvas', 'wood-house-designer' ),
                        'toolbox'          => esc_html__( 'Toolbox', 'wood-house-designer' ),
                        'viewTop'          => esc_html__( 'Top View', 'wood-house-designer' ),
                        'viewIso'          => esc_html__( 'Isometric View', 'wood-house-designer' ),
                        'viewToggleLabel'  => esc_html__( 'View mode', 'wood-house-designer' ),
                        'isoViewStatus'    => esc_html__( 'Isometric view active.', 'wood-house-designer' ),
                        'customHeading'    => esc_html__( 'Create custom cottage', 'wood-house-designer' ),
                        'sidesLabel'       => esc_html__( 'Number of sides', 'wood-house-designer' ),
                        'widthLabel'       => esc_html__( 'Width / bounding width (m)', 'wood-house-designer' ),
                        'depthLabel'       => esc_html__( 'Depth / bounding depth (m)', 'wood-house-designer' ),
                        'heightLabel'      => esc_html__( 'Height (m)', 'wood-house-designer' ),
                        'wallThicknessLabel' => esc_html__( 'Wall thickness (mm)', 'wood-house-designer' ),
                        'addPolygonButton' => esc_html__( 'Add polygon', 'wood-house-designer' ),
                        'invalidPolygon'   => esc_html__( 'Please provide valid values for sides and dimensions.', 'wood-house-designer' ),
                        'customAdded'      => esc_html__( 'Custom cottage added to toolbox.', 'wood-house-designer' ),
                        'placementBlocked' => esc_html__( 'Unable to place cottage without intersections.', 'wood-house-designer' ),
                        'adminCottagesTitle' => esc_html__( 'Catalog cottages', 'wood-house-designer' ),
                        'userCottagesTitle'  => esc_html__( 'Your cottages', 'wood-house-designer' ),
                        'adminDoorsTitle'    => esc_html__( 'Catalog doors', 'wood-house-designer' ),
                        'noDoors'            => esc_html__( 'No doors configured yet.', 'wood-house-designer' ),
                        'doorLabel'          => esc_html__( 'Door %width%m × %height%m', 'wood-house-designer' ),
                        'doorDescription'    => esc_html__( '%panels% panels · %opening%', 'wood-house-designer' ),
                        'doorOpeningInternal'=> esc_html__( 'Internal opening', 'wood-house-designer' ),
                        'doorOpeningExternal'=> esc_html__( 'External opening', 'wood-house-designer' ),
                        'doorStatus'         => esc_html__( 'Selected door - %width%m × %height%m × %thickness%m · %panels% panels · %opening%', 'wood-house-designer' ),
                        'doorPlacementBlocked' => esc_html__( 'Unable to place the door. Add or select a cottage first.', 'wood-house-designer' ),
                        'toolsMenuTitle'     => esc_html__( 'Cottage tools', 'wood-house-designer' ),
                        'toolsDimensionsLabel'=> esc_html__( 'Dimensions', 'wood-house-designer' ),
                        'toolsPositionLabel'  => esc_html__( 'Grid position', 'wood-house-designer' ),
                        'toolsDelete'        => esc_html__( 'Delete cottage', 'wood-house-designer' ),
                        'toolsClose'         => esc_html__( 'Close', 'wood-house-designer' ),
                        'toolsRemoved'       => esc_html__( 'Cottage removed.', 'wood-house-designer' ),
                        'doorToolsRemoved'   => esc_html__( 'Door removed.', 'wood-house-designer' ),
                        'doorToolsMenuTitle' => esc_html__( 'Door tools', 'wood-house-designer' ),
                        'doorToolsDelete'    => esc_html__( 'Delete door', 'wood-house-designer' ),
                    ),
                )
            );
        }

        /**
         * Determine if assets should load on page.
         *
         * @return bool
         */
        protected function should_enqueue() {
            if ( is_admin() ) {
                return false;
            }

            global $post;

            if ( ! $post instanceof WP_Post ) {
                return false;
            }

            if ( has_shortcode( (string) $post->post_content, 'wood_house_designer' ) ) {
                return true;
            }

            $template = get_page_template_slug( $post );

            return 'wood-house-designer-template.php' === $template;
        }
    }
}
