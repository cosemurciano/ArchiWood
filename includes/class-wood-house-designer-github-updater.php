<?php
/**
 * Handles plugin updates served from GitHub releases.
 *
 * @package Wood_House_Designer
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! class_exists( 'Wood_House_Designer_GitHub_Updater' ) ) {
    /**
     * GitHub based updater for the plugin.
     */
    class Wood_House_Designer_GitHub_Updater {
        /**
         * Class instance.
         *
         * @var Wood_House_Designer_GitHub_Updater|null
         */
        protected static $instance = null;

        /**
         * GitHub repository owner.
         *
         * @var string
         */
        protected $owner;

        /**
         * GitHub repository name.
         *
         * @var string
         */
        protected $repository;

        /**
         * Plugin basename.
         *
         * @var string
         */
        protected $plugin_basename;

        /**
         * API cache key.
         */
        const TRANSIENT_KEY = 'wood_house_designer_github_release';

        /**
         * Instantiate the updater.
         */
        private function __construct() {
            $defaults = array(
                'owner'      => 'ArchiWood',
                'repository' => 'ArchiWood',
            );

            $config = apply_filters( 'wood_house_designer_github_updater_config', $defaults );

            $this->owner          = ! empty( $config['owner'] ) ? $config['owner'] : $defaults['owner'];
            $this->repository     = ! empty( $config['repository'] ) ? $config['repository'] : $defaults['repository'];
            $this->plugin_basename = WOOD_HOUSE_DESIGNER_BASENAME;

            add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_for_update' ) );
            add_filter( 'plugins_api', array( $this, 'plugins_api' ), 20, 3 );
            add_action( 'upgrader_process_complete', array( $this, 'clear_cache' ), 10, 2 );
        }

        /**
         * Get class instance.
         *
         * @return Wood_House_Designer_GitHub_Updater
         */
        public static function instance() {
            if ( null === self::$instance ) {
                self::$instance = new self();
            }

            return self::$instance;
        }

        /**
         * Adds update information when a new release is available.
         *
         * @param stdClass $transient Update transient.
         *
         * @return stdClass
         */
        public function check_for_update( $transient ) {
            if ( ! is_object( $transient ) || empty( $transient->checked ) ) {
                return $transient;
            }

            $release = $this->get_latest_release();

            if ( ! $release || empty( $release['tag_name'] ) || empty( $release['zipball_url'] ) ) {
                return $transient;
            }

            $remote_version = ltrim( $release['tag_name'], 'v' );

            if ( version_compare( $remote_version, WOOD_HOUSE_DESIGNER_VERSION, '<=' ) ) {
                return $transient;
            }

            $plugin_info              = new stdClass();
            $plugin_info->slug         = $this->get_slug();
            $plugin_info->plugin       = $this->plugin_basename;
            $plugin_info->new_version  = $remote_version;
            $plugin_info->url          = $this->get_repository_url();
            $plugin_info->package      = $release['zipball_url'];
            $plugin_info->tested       = isset( $release['target_commitish'] ) ? $release['target_commitish'] : '';
            $plugin_info->sections     = array(
                'description' => $this->format_release_notes( $release ),
            );

            $transient->response[ $this->plugin_basename ] = $plugin_info;

            return $transient;
        }

        /**
         * Provides plugin details in the modal window of the update screen.
         *
         * @param false|object|array $result The result object or array.
         * @param string             $action The type of information being requested.
         * @param object             $args   Plugin API arguments.
         *
         * @return object|false
         */
        public function plugins_api( $result, $action, $args ) {
            if ( 'plugin_information' !== $action ) {
                return $result;
            }

            $slug = $this->get_slug();

            if ( empty( $args->slug ) || $slug !== $args->slug ) {
                return $result;
            }

            $release = $this->get_latest_release();

            if ( ! $release || empty( $release['zipball_url'] ) ) {
                return $result;
            }

            $plugin_info = new stdClass();
            $plugin_info->name          = 'Wood House Designer';
            $plugin_info->slug          = $slug;
            $plugin_info->version       = ltrim( $release['tag_name'], 'v' );
            $plugin_info->author        = '<a href="https://github.com/' . esc_attr( $this->owner ) . '">ArchiWood Team</a>';
            $plugin_info->homepage      = $this->get_repository_url();
            $plugin_info->download_link = $release['zipball_url'];
            $plugin_info->sections      = array(
                'description' => $this->format_release_notes( $release ),
            );

            return $plugin_info;
        }

        /**
         * Clears cached API responses after an update.
         *
         * @param WP_Upgrader $upgrader Upgrader instance.
         * @param array       $options  Context options.
         */
        public function clear_cache( $upgrader, $options ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
            unset( $upgrader, $options );
            delete_site_transient( self::TRANSIENT_KEY );
        }

        /**
         * Fetch the latest release details from GitHub.
         *
         * @return array|false
         */
        protected function get_latest_release() {
            $release = get_site_transient( self::TRANSIENT_KEY );

            if ( false !== $release ) {
                return $release;
            }

            $request = wp_remote_get(
                $this->build_api_url( 'releases/latest' ),
                array(
                    'headers' => array(
                        'Accept'     => 'application/vnd.github+json',
                        'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ),
                    ),
                    'timeout' => 15,
                )
            );

            if ( is_wp_error( $request ) ) {
                return false;
            }

            $body = wp_remote_retrieve_body( $request );
            $data = json_decode( $body, true );

            if ( empty( $data ) || ! is_array( $data ) || isset( $data['message'] ) ) {
                return false;
            }

            set_site_transient( self::TRANSIENT_KEY, $data, HOUR_IN_SECONDS * 6 );

            return $data;
        }

        /**
         * Build a GitHub API endpoint.
         *
         * @param string $endpoint API path.
         *
         * @return string
         */
        protected function build_api_url( $endpoint ) {
            return sprintf( 'https://api.github.com/repos/%s/%s/%s', rawurlencode( $this->owner ), rawurlencode( $this->repository ), ltrim( $endpoint, '/' ) );
        }

        /**
         * Returns the repository URL.
         *
         * @return string
         */
        protected function get_repository_url() {
            return sprintf( 'https://github.com/%s/%s', rawurlencode( $this->owner ), rawurlencode( $this->repository ) );
        }

        /**
         * Format release notes into HTML the plugin installer understands.
         *
         * @param array $release GitHub release payload.
         *
         * @return string
         */
        protected function format_release_notes( $release ) {
            if ( empty( $release['body'] ) ) {
                return '';
            }

            return wpautop( wp_kses_post( $release['body'] ) );
        }

        /**
         * Retrieve the plugin slug used by WordPress core dialogs.
         *
         * @return string
         */
        protected function get_slug() {
            $slug = $this->plugin_basename;

            if ( false !== strpos( $slug, '/' ) ) {
                list( $slug ) = explode( '/', $slug, 2 );
            }

            return basename( $slug, '.php' );
        }
    }
}
