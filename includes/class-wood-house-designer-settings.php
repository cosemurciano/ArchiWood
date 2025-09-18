<?php
/**
 * Settings management for Wood House Designer.
 *
 * @package WoodHouseDesigner
 */

if ( ! class_exists( 'Wood_House_Designer_Settings' ) ) {
    /**
     * Settings handler.
     */
    class Wood_House_Designer_Settings {
        /**
         * Singleton instance.
         *
         * @var Wood_House_Designer_Settings
         */
        protected static $instance = null;

        /**
         * Registered option name.
         */
        const OPTION_KEY = 'wood_house_designer_settings';

        /**
         * Default settings values.
         *
         * @var array<string, mixed>
         */
        protected $defaults = array(
            'grid_size'        => 50,
            'scale_ratio'      => 1.0,
            'canvas_width'     => 1000,
            'canvas_height'    => 600,
            'export_file_name' => 'wood-house-project',
            'export_dpi'       => 150,
            'casette'          => array(),
        );

        /**
         * Retrieve singleton instance.
         *
         * @return Wood_House_Designer_Settings
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
            add_action( 'admin_menu', array( $this, 'register_menu' ) );
            add_action( 'admin_init', array( $this, 'register_settings' ) );
            add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
        }

        /**
         * Register settings menu.
         */
        public function register_menu() {
            add_menu_page(
                __( 'Wood House Designer', 'wood-house-designer' ),
                __( 'Wood House Designer', 'wood-house-designer' ),
                'manage_options',
                'wood-house-designer',
                array( $this, 'render_settings_page' ),
                'dashicons-admin-multisite',
                58
            );
        }

        /**
         * Register plugin settings fields.
         */
        public function register_settings() {
            register_setting( 'wood_house_designer_settings', self::OPTION_KEY, array( $this, 'sanitize_options' ) );

            add_settings_section(
                'wood_house_designer_general',
                __( 'General Configuration', 'wood-house-designer' ),
                '__return_false',
                'wood_house_designer_settings'
            );

            add_settings_field(
                'grid_size',
                __( 'Grid Size (px)', 'wood-house-designer' ),
                array( $this, 'render_number_field' ),
                'wood_house_designer_settings',
                'wood_house_designer_general',
                array(
                    'label_for' => 'grid_size',
                    'min'       => 10,
                    'step'      => 5,
                )
            );

            add_settings_field(
                'scale_ratio',
                __( 'Scale Ratio (grid unit in meters)', 'wood-house-designer' ),
                array( $this, 'render_number_field' ),
                'wood_house_designer_settings',
                'wood_house_designer_general',
                array(
                    'label_for' => 'scale_ratio',
                    'min'       => 0.1,
                    'step'      => 0.1,
                )
            );

            add_settings_field(
                'canvas_width',
                __( 'Canvas Width (px)', 'wood-house-designer' ),
                array( $this, 'render_number_field' ),
                'wood_house_designer_settings',
                'wood_house_designer_general',
                array(
                    'label_for' => 'canvas_width',
                    'min'       => 400,
                    'step'      => 10,
                )
            );

            add_settings_field(
                'canvas_height',
                __( 'Canvas Height (px)', 'wood-house-designer' ),
                array( $this, 'render_number_field' ),
                'wood_house_designer_settings',
                'wood_house_designer_general',
                array(
                    'label_for' => 'canvas_height',
                    'min'       => 300,
                    'step'      => 10,
                )
            );

            add_settings_field(
                'export_file_name',
                __( 'Default Export Filename', 'wood-house-designer' ),
                array( $this, 'render_text_field' ),
                'wood_house_designer_settings',
                'wood_house_designer_general',
                array(
                    'label_for' => 'export_file_name',
                )
            );

            add_settings_section(
                'wood_house_designer_casette',
                __( 'Cottages', 'wood-house-designer' ),
                array( $this, 'render_casette_section_intro' ),
                'wood_house_designer_settings'
            );

            add_settings_field(
                'casette',
                __( 'Available Cottages', 'wood-house-designer' ),
                array( $this, 'render_casette_field' ),
                'wood_house_designer_settings',
                'wood_house_designer_casette',
                array(
                    'label_for' => 'casette',
                )
            );
        }

        /**
         * Enqueue admin scripts for settings page.
         *
         * @param string $hook Current admin page hook.
         */
        public function enqueue_admin_assets( $hook ) {
            if ( 'toplevel_page_wood-house-designer' !== $hook ) {
                return;
            }

            wp_enqueue_style(
                'wood-house-designer-admin',
                WOOD_HOUSE_DESIGNER_URL . 'assets/css/admin.css',
                array(),
                WOOD_HOUSE_DESIGNER_VERSION
            );

            wp_enqueue_script(
                'wood-house-designer-admin',
                WOOD_HOUSE_DESIGNER_URL . 'assets/js/admin.js',
                array(),
                WOOD_HOUSE_DESIGNER_VERSION,
                true
            );

            wp_localize_script(
                'wood-house-designer-admin',
                'WoodHouseDesignerAdmin',
                array(
                    'addLabel'    => __( 'Add Cottage', 'wood-house-designer' ),
                    'removeLabel' => __( 'Remove', 'wood-house-designer' ),
                    'emptyLabel'  => __( 'No cottages configured yet.', 'wood-house-designer' ),
                )
            );
        }

        /**
         * Render number input field.
         *
         * @param array $args Field arguments.
         */
        public function render_number_field( $args ) {
            $options = $this->get_options();
            $id      = esc_attr( $args['label_for'] );
            $min     = isset( $args['min'] ) ? (float) $args['min'] : '';
            $step    = isset( $args['step'] ) ? (float) $args['step'] : 'any';
            $value   = isset( $options[ $id ] ) ? $options[ $id ] : '';
            ?>
            <input type="number" id="<?php echo $id; ?>" name="<?php echo esc_attr( self::OPTION_KEY . '[' . $id . ']' ); ?>" value="<?php echo esc_attr( $value ); ?>" min="<?php echo esc_attr( $min ); ?>" step="<?php echo esc_attr( $step ); ?>" class="small-text" />
            <?php
        }

        /**
         * Render text input field.
         *
         * @param array $args Field arguments.
         */
        public function render_text_field( $args ) {
            $options = $this->get_options();
            $id      = esc_attr( $args['label_for'] );
            $value   = isset( $options[ $id ] ) ? $options[ $id ] : '';
            ?>
            <input type="text" id="<?php echo $id; ?>" name="<?php echo esc_attr( self::OPTION_KEY . '[' . $id . ']' ); ?>" value="<?php echo esc_attr( $value ); ?>" class="regular-text" />
            <?php
        }

        /**
         * Sanitize option values.
         *
         * @param array $input Raw form values.
         *
         * @return array Sanitized options.
         */
        public function sanitize_options( $input ) {
            $input = is_array( $input ) ? $input : array();
            $sanitized = $this->get_defaults();

            if ( isset( $input['grid_size'] ) ) {
                $sanitized['grid_size'] = max( 10, (int) $input['grid_size'] );
            }

            if ( isset( $input['scale_ratio'] ) ) {
                $sanitized['scale_ratio'] = max( 0.1, (float) $input['scale_ratio'] );
            }

            if ( isset( $input['canvas_width'] ) ) {
                $sanitized['canvas_width'] = max( 400, (int) $input['canvas_width'] );
            }

            if ( isset( $input['canvas_height'] ) ) {
                $sanitized['canvas_height'] = max( 300, (int) $input['canvas_height'] );
            }

            if ( isset( $input['export_file_name'] ) ) {
                $sanitized['export_file_name'] = sanitize_file_name( $input['export_file_name'] );
                if ( empty( $sanitized['export_file_name'] ) ) {
                    $sanitized['export_file_name'] = $this->defaults['export_file_name'];
                }
            }

            if ( isset( $input['casette'] ) && is_array( $input['casette'] ) ) {
                $casette = array();

                foreach ( $input['casette'] as $item ) {
                    if ( ! is_array( $item ) ) {
                        continue;
                    }

                    $width  = isset( $item['width'] ) ? (float) $item['width'] : 0.0;
                    $depth  = isset( $item['depth'] ) ? (float) $item['depth'] : 0.0;
                    $height = isset( $item['height'] ) ? (float) $item['height'] : 0.0;

                    if ( $width <= 0 || $depth <= 0 ) {
                        continue;
                    }

                    if ( $height <= 0 ) {
                        $height = 3.0;
                    }

                    $casette[] = array(
                        'width'  => round( $width, 2 ),
                        'depth'  => round( $depth, 2 ),
                        'height' => round( $height, 2 ),
                    );
                }

                $sanitized['casette'] = $casette;
            }

            return $sanitized;
        }

        /**
         * Render introduction text for cottages section.
         */
        public function render_casette_section_intro() {
            echo '<p>' . esc_html__( 'Define the list of cottage volumes available in the designer. Width, depth, and height are expressed in meters.', 'wood-house-designer' ) . '</p>';
        }

        /**
         * Render cottage repeatable field.
         */
        public function render_casette_field() {
            $options = $this->get_options();
            $casette = isset( $options['casette'] ) && is_array( $options['casette'] ) ? $options['casette'] : array();
            $field_name = self::OPTION_KEY . '[casette]';
            ?>
            <div id="whd-casette-wrapper" class="whd-casette-wrapper" data-field-name="<?php echo esc_attr( $field_name ); ?>">
                <div id="whd-casette-list" class="whd-casette-list" data-index="<?php echo esc_attr( count( $casette ) ); ?>">
                    <?php if ( empty( $casette ) ) : ?>
                        <p class="whd-casette-empty"><?php esc_html_e( 'No cottages configured yet.', 'wood-house-designer' ); ?></p>
                    <?php else : ?>
                        <?php foreach ( $casette as $index => $item ) :
                            $width  = isset( $item['width'] ) ? $item['width'] : '';
                            $depth  = isset( $item['depth'] ) ? $item['depth'] : '';
                            $height = isset( $item['height'] ) ? $item['height'] : '3';
                            ?>
                            <div class="whd-casetta-row" data-index="<?php echo esc_attr( $index ); ?>">
                                <div class="whd-casetta-field">
                                    <label>
                                        <?php esc_html_e( 'Width (m)', 'wood-house-designer' ); ?>
                                        <input type="number" min="0" step="0.01" name="<?php echo esc_attr( $field_name . '[' . $index . '][width]' ); ?>" value="<?php echo esc_attr( $width ); ?>" />
                                    </label>
                                </div>
                                <div class="whd-casetta-field">
                                    <label>
                                        <?php esc_html_e( 'Depth (m)', 'wood-house-designer' ); ?>
                                        <input type="number" min="0" step="0.01" name="<?php echo esc_attr( $field_name . '[' . $index . '][depth]' ); ?>" value="<?php echo esc_attr( $depth ); ?>" />
                                    </label>
                                </div>
                                <div class="whd-casetta-field">
                                    <label>
                                        <?php esc_html_e( 'Height (m)', 'wood-house-designer' ); ?>
                                        <input type="number" min="0" step="0.01" name="<?php echo esc_attr( $field_name . '[' . $index . '][height]' ); ?>" value="<?php echo esc_attr( $height ); ?>" />
                                    </label>
                                </div>
                                <button type="button" class="button whd-remove-casetta"><?php esc_html_e( 'Remove', 'wood-house-designer' ); ?></button>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
                <button type="button" class="button button-secondary" id="whd-add-casetta"><?php esc_html_e( 'Add Cottage', 'wood-house-designer' ); ?></button>
            </div>
            <script type="text/html" id="tmpl-whd-casetta-row">
                <div class="whd-casetta-row" data-index="{{index}}">
                    <div class="whd-casetta-field">
                        <label>
                            <?php esc_html_e( 'Width (m)', 'wood-house-designer' ); ?>
                            <input type="number" min="0" step="0.01" name="<?php echo esc_attr( $field_name ); ?>[{{index}}][width]" value="" />
                        </label>
                    </div>
                    <div class="whd-casetta-field">
                        <label>
                            <?php esc_html_e( 'Depth (m)', 'wood-house-designer' ); ?>
                            <input type="number" min="0" step="0.01" name="<?php echo esc_attr( $field_name ); ?>[{{index}}][depth]" value="" />
                        </label>
                    </div>
                    <div class="whd-casetta-field">
                        <label>
                            <?php esc_html_e( 'Height (m)', 'wood-house-designer' ); ?>
                            <input type="number" min="0" step="0.01" name="<?php echo esc_attr( $field_name ); ?>[{{index}}][height]" value="3" />
                        </label>
                    </div>
                    <button type="button" class="button whd-remove-casetta"><?php esc_html_e( 'Remove', 'wood-house-designer' ); ?></button>
                </div>
            </script>
            <?php
        }

        /**
         * Render settings page.
         */
        public function render_settings_page() {
            ?>
            <div class="wrap">
                <h1><?php esc_html_e( 'Wood House Designer Settings', 'wood-house-designer' ); ?></h1>
                <form action="options.php" method="post">
                    <?php
                    settings_fields( 'wood_house_designer_settings' );
                    do_settings_sections( 'wood_house_designer_settings' );
                    submit_button();
                    ?>
                </form>
            </div>
            <?php
        }

        /**
         * Retrieve saved options.
         *
         * @return array<string, mixed>
         */
        public function get_options() {
            $options = get_option( self::OPTION_KEY, array() );

            return wp_parse_args( $options, $this->get_defaults() );
        }

        /**
         * Get default values.
         *
         * @return array<string, mixed>
         */
        public function get_defaults() {
            return $this->defaults;
        }
    }
}
