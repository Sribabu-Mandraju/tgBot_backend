<?php
require_once(dirname(__FILE__) . '/../../../wp-load.php');
require_once(dirname(__FILE__) . '/readies-for-woocommerce.php');


if (!isset($_GET['invoice_id']) || !isset($_GET['resultCode'])) {
    die('Invalid request. Invoice ID and Result Code are required.');
}

$invoice_id = intval($_GET['invoice_id']);
$resultCode = sanitize_text_field($_GET['resultCode']);
$transaction_id = isset($_GET['txn_id']) ? sanitize_text_field($_GET['txn_id']) : '';

// Fetch custom status settings from WooCommerce options
$payment_options = get_option('woocommerce_readies_settings', array());
$status_new_order = $payment_options['status_new_order'] ?? 'wc-pending';
$status_confirmed = $payment_options['status_confirmed'] ?? 'wc-processing';
$status_invalid = $payment_options['status_invalid'] ?? 'wc-failed';
$status_cancelled = 'wc-cancelled';

// Check if we have a valid order
$order = wc_get_order($invoice_id);
if (!$order) {
    die('Order not found.');
}


switch ($resultCode) {
    case 'completed':
        if ($status_confirmed === 'wc-completed') {
            $order->payment_complete($transaction_id);
            $order->update_status($status_confirmed, __('Payment received, your order is now completed.', 'readies_payment'));
        } else {
            $order->update_status($status_confirmed, __('Payment received, your order is now processing.', 'readies_payment'));
        }
        $order->add_order_note(__('Readies payment completed.', 'your-textdomain'));
        $order_id = $order->get_id();
        WC()->mailer()->get_emails()['WC_Email_Customer_Processing_Order']->trigger($order_id);
        break;
    
    case 'pending':
        $order->update_status($status_new_order, __('Readies payment is pending.', 'readies_payment'));
        break;
    
    case 'cancelled':
        $order->update_status($status_cancelled, __('Readies payment was cancelled.', 'readies_payment'));
        $order->add_order_note(__('Payment cancelled by user or payment gateway.', 'readies_payment'));
        break;

    case 'failed':
        $order->update_status($status_invalid, __('Readies payment failed or was declined.', 'readies_payment'));
        $order->add_order_note(__('Payment failed or was declined by user or payment gateway.', 'readies_payment'));
        break;

    default:
        $order->update_status($status_invalid, __('Readies payment failed or was declined.', 'readies_payment'));
        break;
}
$url = $order->get_checkout_order_received_url();

header('Location: ' . esc_url_raw($url));
exit;