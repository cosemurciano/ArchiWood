<?php
/**
 * Page template loader for Wood House Designer.
 *
 * @package WoodHouseDesigner
 */

if ( ! class_exists( 'Wood_House_Designer_Template_Loader' ) ) {
    /**
     * Template loader utility.
     */
    class Wood_House_Designer_Template_Loader {
        /**
         * Singleton instance.
         *
         * @var Wood_House_Designer_Template_Loader
         */
        protected static $instance = null;

        /**
         * Template slug.
         */
        const TEMPLATE_SLUG = 'wood-house-designer-template.php';

        /**
         * Retrieve singleton instance.
         *
         * @return Wood_House_Designer_Template_Loader
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
            add_filter( 'theme_page_templates', array( $this, 'add_page_template' ) );
            add_filter( 'template_include', array( $this, 'load_template' ) );
        }

        /**
         * Register template in page template dropdown.
         *
         * @param array $templates Available templates.
         *
         * @return array
         */
        public function add_page_template( $templates ) {
            $templates[ self::TEMPLATE_SLUG ] = __( 'Wood House Designer App', 'wood-house-designer' );

            return $templates;
        }

        /**
         * Load plugin template when selected.
         *
         * @param string $template Path to template.
         *
         * @return string
         */
        public function load_template( $template ) {
            if ( is_singular() ) {
                $chosen_template = get_page_template_slug();
                if ( self::TEMPLATE_SLUG === $chosen_template ) {
                    $plugin_template = WOOD_HOUSE_DESIGNER_PATH . 'templates/' . self::TEMPLATE_SLUG;
                    if ( file_exists( $plugin_template ) ) {
                        return $plugin_template;
                    }
                }
            }

            return $template;
        }
    }
}
