<?php

/*

Plugin Name: Readies Payment Gateway
Description: Readies Payment Gateway
Version: 2.6.1
Author: Readies
Author URI: https://www.readies.biz
License: GPL2
Text Domain: readies-payment-gateway
WooCommerce requires at least: 3.0

*/

if (
    in_array(
        "woocommerce/woocommerce.php",
        apply_filters("active_plugins", get_option("active_plugins"))
    )
) {
    if (!defined("ABSPATH")) {
        exit(); // Exit if accessed directly
    }

    /**

 * Readies Payment Gateway.

 *

 * Provides a Readies Payment Gateway, mainly for testing purposes.

 */

    add_action("plugins_loaded", "init_readies_gateway_class");

    function init_readies_gateway_class()
    {
        class WC_Gateway_readies extends WC_Payment_Gateway
        {
            protected $domain;

            /**
             * Constructor for the gateway.
             */
            public function __construct()
            {
                $this->domain = "readies_payment";
                $this->id = "readies";
                $this->icon = apply_filters("woocommerce_readies_icon", "");
                $this->has_fields = false;
                $this->method_title = __("Readies", $this->domain);
                $this->method_description = __(
                    "Allows payments with Readies gateway.",
                    $this->domain
                );

                // Load the form fields and settings
                $this->init_form_fields();
                $this->init_settings();

                // Define user set variables using proper sanitization
                $this->title = sanitize_text_field($this->get_option("title"));
                $this->description = sanitize_textarea_field(
                    $this->get_option("description")
                );
                $this->instructions = sanitize_textarea_field(
                    $this->get_option("instructions", $this->description)
                );
                $this->order_status = sanitize_text_field(
                    $this->get_option("order_status", "completed")
                );

                // Actions
                add_action(
                    "woocommerce_update_options_payment_gateways_" . $this->id,
                    [$this, "process_admin_options"]
                );
                add_action("woocommerce_thankyou_" . $this->id, [
                    $this,
                    "thankyou_page",
                ]);

                // Customer Emails
                add_action(
                    "woocommerce_email_before_order_table",
                    [$this, "email_instructions"],
                    10,
                    3
                );
            }
            /**

         * Initialise Gateway Settings Form Fields.

         */

            public function init_form_fields()
            {
                $this->form_fields = [
                    "enabled" => [
                        "title" => __("Enable/Disable", $this->domain),

                        "type" => "checkbox",

                        "label" => __("Enable Readies Payment", $this->domain),

                        "default" => "yes",
                    ],

                    "title" => [
                        "title" => __("Title", $this->domain),

                        "type" => "text",

                        "description" => __(
                            "This controls the title which the user sees during checkout.",
                            $this->domain
                        ),

                        "default" => __(
                            "Readies Payment (Pay now with all major credit/debit cards, e-wallets and instant banking)",
                            $this->domain
                        ),

                        "desc_tip" => true,
                    ],

                    "merchant_email" => [
                        "title" => __("Merchant Email", $this->domain),

                        "type" => "text",

                        "description" => __(
                            "Readies access token.",
                            $this->domain
                        ),

                        "default" => __("", $this->domain),

                        "desc_tip" => true,
                    ],

                    "public_key" => [
                        "title" => __("Public Key", $this->domain),

                        "type" => "text",

                        "description" => __(
                            "Readies Public Key.",
                            $this->domain
                        ),

                        "default" => __("", $this->domain),

                        "desc_tip" => true,
                    ],

                    "private_key" => [
                        "title" => __("Private Key", $this->domain),

                        "type" => "text",

                        "description" => __(
                            "Readies Private Key.",
                            $this->domain
                        ),

                        "default" => __("", $this->domain),

                        "desc_tip" => true,
                    ],

                    "description" => [
                        "title" => __("Description", $this->domain),

                        "type" => "textarea",

                        "description" => __(
                            "Payment method description that the readies user will see on your checkout.",
                            $this->domain
                        ),

                        "default" => __("Payment Information", $this->domain),

                        "desc_tip" => true,
                    ],

                    "instructions" => [
                        "title" => __("Instructions", $this->domain),

                        "type" => "textarea",

                        "description" => __(
                            "Instructions that will be added to the thank you page and emails.",
                            $this->domain
                        ),

                        "default" => "",

                        "desc_tip" => true,
                    ],

                    "auto_create_user" => [
                        "title" => __("Auto Create User", $this->domain),

                        "type" => "checkbox",

                        "description" => __(
                            "Enable automatic user creation on READIES, you must have performed KYC",
                            $this->domain
                        ),

                        "default" => "no", // or 'yes' if you want it to be enabled by default

                        "desc_tip" => true,
                    ],

                    "opt_completed" => [
                        "title" => __("Disable OTP on READIES", $this->domain),

                        "type" => "checkbox",

                        "description" => __(
                            "Disable OTP on READIES, you must have performed OTP on your site before changing this to yes, you are liable for confirming your customer is who they say they are. READIES Support must also approve this setting via a support request",
                            $this->domain
                        ),

                        "default" => "no", // or 'yes' if you want it to be enabled by default

                        "desc_tip" => true,
                    ],

                    "supply_billing_address" => [
                        "title" => __(
                            "Supply billing information to READIES",
                            $this->domain
                        ),

                        "type" => "checkbox",

                        "description" => __(
                            "Enable the billing address to be sent to READIES, this will make checkout faster for the customer.",
                            $this->domain
                        ),

                        "default" => "no", // or 'yes' if you want it to be enabled by default

                        "desc_tip" => true,
                    ],

                    "hmac_secret" => [
                        "title" => __("HMAC Secret", $this->domain),
                        "type" => "text",
                        "description" => __(
                            "Your secret key for HMAC signature verification.",
                            $this->domain
                        ),
                        "default" =>
                            "You must have set this in the READIES merchant settings panel",
                        "desc_tip" => true,
                    ],

                    "status_new_order" => [
                        "title" => __("Status for New Order", $this->domain),
                        "type" => "select",
                        "options" => wc_get_order_statuses(),
                        "description" => __(
                            "Select the order status to be set for new orders.",
                            $this->domain
                        ),
                        "default" => "wc-pending",
                        "desc_tip" => true,
                    ],

                    "status_confirmed" => [
                        "title" => __("Status for Confirmed", $this->domain),
                        "type" => "select",
                        "options" => wc_get_order_statuses(),
                        "description" => __(
                            "Select the order status to be set for confirmed orders.",
                            $this->domain
                        ),
                        "default" => "wc-processing",
                        "desc_tip" => true,
                    ],

                    "status_invalid" => [
                        "title" => __("Status for Invalid", $this->domain),
                        "type" => "select",
                        "options" => wc_get_order_statuses(),
                        "description" => __(
                            "Select the order status to be set for invalid orders.",
                            $this->domain
                        ),
                        "default" => "wc-failed",
                        "desc_tip" => true,
                    ],
                ];
            }

            /**

         * Output for the order received page.

         */

            public function thankyou_page($order_id)
            {
                // Check if the instructions are set and not empty
                if (!empty($this->instructions)) {
                    // Ensure that the order ID is an integer to avoid any unexpected values
                    $order_id = absint($order_id);

                    // Load the order details
                    $order = wc_get_order($order_id);

                    // Double-check that the order is a valid object before trying to use it
                    if (is_a($order, "WC_Order")) {
                        // Display instructions if the payment method of the order is Readies
                        if ($this->id === $order->get_payment_method()) {
                            // Use wpautop for auto-formatting and wptexturize for smart quotes and other typographic transforms
                            echo wpautop(wptexturize($this->instructions));
                        }
                    }
                }
            }

            /**

         * Add content to the WC emails.

         *

         * @access public

         * @param WC_Order $order

         * @param bool $sent_to_admin

         * @param bool $plain_text

         */

            public function email_instructions(
                $order,
                $sent_to_admin,
                $plain_text = false
            ) {
                if (
                    $this->instructions &&
                    !$sent_to_admin &&
                    $this->id === $order->get_payment_method() &&
                    $order->has_status("on-hold", "pending_payment")
                ) {
                    // Check if the plain text parameter is set to true, and format instructions accordingly
                    if ($plain_text) {
                        echo wp_strip_all_tags(
                            wptexturize($this->instructions)
                        ) . PHP_EOL;
                    } else {
                        echo wpautop(wptexturize($this->instructions)) .
                            PHP_EOL;
                    }
                }
            }

            /**

         * Process the payment and return the result.

         *

         * @param int $order_id

         * @return array

         */

            public function process_payment($order_id)
            {
                $order = wc_get_order($order_id);
                global $woocommerce;
                $items = $woocommerce->cart->get_cart();
                $data = [];
                    foreach ( $items as $cart_item_key => $cart_item ) {
                        $product_id = $cart_item['product_id'];
                        $product_name = $cart_item['data']->get_name();
                        $quantity = $cart_item['quantity'];
                        $product_price = $cart_item['data']->get_price();
                        $total_price = $product_price * $quantity;

                        $data[] = [
                            'product_id' => $product_id,
                            'product_name' => $product_name,
                            'quantity' => $quantity,
                            'product_price' => $product_price,
                            'total_price' => $total_price,
                            'currency' => $order->get_currency(),
                        ];
                     }

                // Sanitize and validate data before making the API request
                $authtoken = sanitize_text_field(
                    $this->getReadiesMerchantToken()
                );

                if (empty($authtoken)) {
                    wc_add_notice(
                        __(
                            "Unable to authenticate payment gateway.",
                            $this->domain
                        ),
                        "error"
                    );
                    return;
                }

                // Use esc_url_raw for URLs to be used in HTTP requests
                // Construct the return URL to point to the return_data file
                $callback_url = plugins_url("return_data.php", __FILE__); // Path to your return_data.php file

                // Success URL
                $success_url = add_query_arg(
                    [
                        "invoice_id" => $order_id,
                        "key" => $order->get_order_key(),
                        "resultCode" => "completed",
                    ],
                    $callback_url
                );
                $success_url = esc_url_raw($success_url);

                // Cancellation URL
                $cancel_url = add_query_arg(
                    [
                        "invoice_id" => $order_id,
                        "key" => $order->get_order_key(),
                        "resultCode" => "cancelled",
                    ],
                    $callback_url
                );
                $cancel_url = esc_url_raw($cancel_url);

                $callback_url = esc_url_raw(
                    plugins_url() . "/readies_wordpress/return_data.php"
                );

                // Validate options and prepare data
                $user_creation =
                    $this->get_option("auto_create_user") === "yes"
                        ? "true"
                        : "false";
                $buyer_opt_completed =
                    $this->get_option("opt_completed") === "yes"
                        ? "true"
                        : "false";
                $address_supplied =
                    $this->get_option("supply_billing_address") === "yes"
                        ? "true"
                        : "false";

                // Prepare data for the API request
                $post = [
                    "plugins_version" => '2.6.1',
                    "cmd" => "simple",
                    "amount" => $order->get_total(),
                    "currency1" => $order->get_currency(),
                    "currency2" => "READIES",
                    "user_creation" => $user_creation,
                    "buyer_opt_completed" => $buyer_opt_completed,
                    "buyer_email" => $order->get_billing_email(),
                    "buyer_first_name" => $order->get_billing_first_name(),
                    "buyer_last_name" => $order->get_billing_last_name(),
                    "address_supplied" => $address_supplied,
                    "address_line1" => $order->get_billing_address_1(),
                    "address_line2" => $order->get_billing_address_2(),
                    "address_city" => $order->get_billing_city(),
                    "address_state_province" => $order->get_billing_state(),
                    "address_country" => $order->get_billing_country(),
                    "address_postal_code" => $order->get_billing_postcode(),
                    "item_name" => "Online Purchase",
                    "item_number" => "122",
                    "ipn_url" => $callback_url,
                    "invoice" => $order->get_id(),
                    "success_url" => $success_url,
                    "cancel_url" => $cancel_url,
                    "buyer_mobile" => $order->get_billing_phone(),
                    'description' => json_encode($data),
                ];

                
                // Check if the token was successfully retrieved
                if (false === $authtoken) {
                    // Handle the error appropriately
                    wc_add_notice(
                        __(
                            "Unable to retrieve the Readies token.",
                            $this->domain
                        ),
                        "error"
                    );
                    return;
                }

                // Use wp_remote_post for making HTTP requests within WordPress
                $response = wp_remote_post(
                    "https://api.readies.biz/api/create_transaction",
                    [
                        "headers" => [
                            "Content-Type" =>
                                "application/x-www-form-urlencoded",
                            "Authorization" => "Bearer " . $authtoken, // Properly formatted Authorization header
                        ],
                        "body" => http_build_query($post),
                        "method" => "POST",
                        "data_format" => "body",
                    ]
                );

                // Handle WP errors
                if (is_wp_error($response)) {
                    wc_add_notice(
                        __("Connection error.", $this->domain),
                        "error"
                    );
                    return;
                }

                // Decode the response and handle it
                $result = json_decode(wp_remote_retrieve_body($response));

                // Handle API errors
                if (!$result || $result->status != true) {
                    wc_add_notice(
                        isset($result->message)
                            ? __($result->message, $this->domain)
                            : __("API error.", $this->domain),
                        "error"
                    );
                    return;
                }

                if (isset($result->status) && true === $result->status) {
                    // Sanitize and save the response data as order meta
                    update_post_meta(
                        $order_id,
                        "_original_amount",
                        sanitize_text_field($result->response->original_amount)
                    );
                    update_post_meta(
                        $order_id,
                        "_original_currency",
                        sanitize_text_field(
                            $result->response->original_currency
                        )
                    );
                    update_post_meta(
                        $order_id,
                        "_selected_amount",
                        sanitize_text_field($result->response->selected_amount)
                    );
                    update_post_meta(
                        $order_id,
                        "_selected_currency",
                        sanitize_text_field(
                            $result->response->selected_currency
                        )
                    );
                    update_post_meta(
                        $order_id,
                        "_payment_address",
                        sanitize_text_field($result->response->address)
                    );
                    update_post_meta(
                        $order_id,
                        "_payment_id",
                        sanitize_text_field($result->response->payment_id)
                    );
                    update_post_meta(
                        $order_id,
                        "_confirms_needed",
                        sanitize_text_field($result->response->confirms_needed)
                    );
                    update_post_meta(
                        $order_id,
                        "_payment_timeout",
                        sanitize_text_field($result->response->timeout)
                    );
                    update_post_meta(
                        $order_id,
                        "_checkout_url",
                        esc_url_raw($result->response->checkout_url)
                    );

                    // // Manually trigger the New Order email notification to admin
                    // WC()->mailer()->get_emails()['WC_Email_New_Order']->trigger($order_id);

                    // Return success and redirect to the checkout URL provided by the payment processor
                    return [
                        "result" => "success",
                        "redirect" => esc_url_raw(
                            $result->response->checkout_url
                        ),
                    ];
                }

                // Handle failure by adding an error notice with sanitized text
                if (isset($result->message)) {
                    wc_add_notice(
                        esc_html__($result->message, $this->domain),
                        "error"
                    );
                }
            }

            public function getReadiesMerchantToken()
            {
                // Retrieve sanitized merchant details
                $merchant_email = sanitize_email(
                    $this->get_option("merchant_email")
                );
                $public_key = sanitize_text_field(
                    $this->get_option("public_key")
                );
                $private_key = sanitize_text_field(
                    $this->get_option("private_key")
                );

                // Ensure all credentials are provided
                if (
                    empty($merchant_email) ||
                    empty($public_key) ||
                    empty($private_key)
                ) {
                    wc_add_notice(
                        __(
                            "Error: Merchant email, public key, and private key must be configured.",
                            $this->domain
                        ),
                        "error"
                    );
                    return false;
                }

                // Prepare the payload for the token request
                $payload = [
                    "email" => $merchant_email,
                    "public_key" => $public_key,
                    "private_key" => $private_key,
                ];

                // Use wp_remote_post for the HTTP POST request
                $response = wp_remote_post(
                    "https://api.readies.biz/api/get_authorized_token",
                    [
                        "method" => "POST",
                        "headers" => [
                            "Content-Type" =>
                                "application/x-www-form-urlencoded",
                        ],
                        "body" => http_build_query($payload),
                        "timeout" => 45,
                    ]
                );

                // Handle HTTP errors
                if (is_wp_error($response)) {
                    $error_message = $response->get_error_message();
                    wc_add_notice(
                        __("Connection error: ", $this->domain) .
                            $error_message,
                        "error"
                    );
                    return false;
                }

                // Decode the response body
                $body = wp_remote_retrieve_body($response);
                $result = json_decode($body);

                // Handle API errors
                if (
                    !is_object($result) ||
                    empty($result->status) ||
                    $result->status !== true
                ) {
                    wc_add_notice(
                        __(
                            "Error retrieving Readies merchant token.",
                            $this->domain
                        ),
                        "error"
                    );
                    return false;
                }

                // Return the token if it's available
                if (isset($result->response->authorize_token)) {
                    return str_replace(
                        "Bearer ",
                        "",
                        sanitize_text_field($result->response->authorize_token)
                    );
                } else {
                    wc_add_notice(
                        __(
                            "Error: Invalid token received from Readies API.",
                            $this->domain
                        ),
                        "error"
                    );
                    return false;
                }
            }
        }
    }

    // Add the custom payment gateway to the list of WooCommerce payment gateways
    add_filter("woocommerce_payment_gateways", "add_readies_gateway_class");
    function add_readies_gateway_class($methods)
    {
        $methods[] = "WC_Gateway_readies";
        return $methods;
    }

    // Determine whether certain meta fields should be protected
    add_filter("is_protected_meta", "show_custom_order_meta", 10, 3);
    function show_custom_order_meta($protected, $meta_key, $meta_type)
    {
        $custom_fields = [
            "_original_amount",
            "_original_currency",
            "_selected_amount",
            "_selected_currency",
            "_payment_address",
            "_payment_id",
            "_confirms_needed",
            "_payment_timeout",
            "_checkout_url",
        ];

        if (
            "post" === $meta_type &&
            in_array($meta_key, $custom_fields, true)
        ) {
            // Get the order ID from the current screen or global post variable
            $order_id = null;
            if (function_exists("get_current_screen")) {
                $screen = get_current_screen();
                if (
                    $screen &&
                    "post" === $screen->base &&
                    "shop_order" === $screen->post_type
                ) {
                    $order_id = isset($_GET["post"])
                        ? intval($_GET["post"])
                        : null;
                }
            } elseif (is_admin() && isset($GLOBALS["post"])) {
                $order_id = $GLOBALS["post"]->ID;
            }

            // If we have an order ID, get the order and check the payment method
            if ($order_id) {
                $order = wc_get_order($order_id);
                if ($order && "readies" === $order->get_payment_method()) {
                    $protected = false; // Unprotect the meta if it's a Readies order
                }
            }
        }

        return $protected;
    }
} else {
    // WooCommerce is not active, you can either show a message or deactivate your plugin
    add_action("admin_notices", "readies_no_woocommerce_notice");

    function readies_no_woocommerce_notice()
    {
        echo '<div class="error"><p><strong>Readies Payment Gateway</strong> requires WooCommerce to be installed and active.</p></div>';
    }
}