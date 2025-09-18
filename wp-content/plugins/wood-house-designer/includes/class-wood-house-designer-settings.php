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
        }

        /**
         * Register settings menu.
         */
        public function register_menu() {
            add_options_page(
                __( 'Wood House Designer', 'wood-house-designer' ),
                __( 'Wood House Designer', 'wood-house-designer' ),
                'manage_options',
                'wood-house-designer',
                array( $this, 'render_settings_page' )
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

            return $sanitized;
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
