<?php
/**
 * Template file for Wood House Designer app.
 *
 * @package WoodHouseDesigner
 */

defined( 'ABSPATH' ) || exit;

?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
    <head>
        <meta charset="<?php bloginfo( 'charset' ); ?>" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <?php wp_head(); ?>
    </head>
    <body <?php body_class( 'wood-house-designer-fullscreen' ); ?>>
        <?php
        if ( function_exists( 'wp_body_open' ) ) {
            wp_body_open();
        }
        ?>
        <div class="wood-house-designer-fullscreen__container">
            <?php
            while ( have_posts() ) {
                the_post();
                $raw_content   = get_the_content();
                $has_shortcode = has_shortcode( $raw_content, 'wood_house_designer' );
                ?>
                <div class="wood-house-designer-fullscreen__content">
                    <?php
                    if ( ! empty( $raw_content ) ) {
                        echo apply_filters( 'the_content', $raw_content ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                    }

                    if ( ! $has_shortcode ) {
                        echo do_shortcode( '[wood_house_designer]' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                    }
                    ?>
                </div>
                <?php
            }
            ?>
        </div>
        <?php wp_footer(); ?>
    </body>
</html>
