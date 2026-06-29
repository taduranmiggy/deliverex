<?php

namespace App\Services\Email;

final class EmailType
{
    public const COMPANY_ACTIVATION = 'company_activation';

    public const COMPANY_INVITATION = 'company_invitation';

    public const DRIVER_CREDENTIALS = 'driver_credentials';

    public const USER_INVITATION = 'user_invitation';

    public const PASSWORD_RESET = 'password_reset';

    public const EMAIL_VERIFICATION = 'email_verification';

    public const DELIVERY_ASSIGNED = 'delivery_assigned';

    public const DELIVERY_EN_ROUTE = 'delivery_en_route';

    public const DELIVERY_ARRIVED_AT_PICKUP = 'delivery_arrived_at_pickup';

    public const DELIVERY_ARRIVED = 'delivery_arrived';

    public const DELIVERY_COMPLETED = 'delivery_completed';

    public const POD_AVAILABLE = 'pod_available';

    public const CONTACT_SUPPORT = 'contact_support';

    public const SUPPORT_INQUIRY = 'support_inquiry';

    public const ACCOUNT_DISABLED = 'account_disabled';

    public const ACTIVATION_EXPIRED = 'activation_expired';

    public const LOGIN_ALERT = 'login_alert';

    public const SESSION_WARNING = 'session_warning';

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::COMPANY_ACTIVATION => 'Company Activation',
            self::COMPANY_INVITATION => 'Company User Invitation',
            self::DRIVER_CREDENTIALS => 'Driver Credentials',
            self::USER_INVITATION => 'User Invitation',
            self::PASSWORD_RESET => 'Password Reset',
            self::EMAIL_VERIFICATION => 'Email Verification',
            self::DELIVERY_ASSIGNED => 'Delivery Assigned',
            self::DELIVERY_EN_ROUTE => 'Delivery En Route',
            self::DELIVERY_ARRIVED_AT_PICKUP => 'Delivery Arrived at Pickup',
            self::DELIVERY_ARRIVED => 'Delivery Arrived',
            self::DELIVERY_COMPLETED => 'Delivery Completed',
            self::POD_AVAILABLE => 'POD Available',
            self::CONTACT_SUPPORT => 'Contact Support',
            self::SUPPORT_INQUIRY => 'Support Inquiry',
            self::ACCOUNT_DISABLED => 'Account Disabled',
            self::ACTIVATION_EXPIRED => 'Activation Expired',
            self::LOGIN_ALERT => 'Login Alert',
            self::SESSION_WARNING => 'Session Warning',
        ];
    }
}
