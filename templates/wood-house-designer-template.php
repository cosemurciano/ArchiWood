<?php
/**
 * Template file for Wood House Designer app.
 *
 * @package WoodHouseDesigner
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="primary" class="site-main wood-house-designer-template">
    <?php
    while ( have_posts() ) {
        the_post();
        the_content();
        echo do_shortcode( '[wood_house_designer]' );
    }
    ?>
</main>
<?php
get_footer();
