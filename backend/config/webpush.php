<?php

return [

    /*
    |--------------------------------------------------------------------------
    | VAPID Public Key
    |--------------------------------------------------------------------------
    */

    'vapid_public_key' => env('VAPID_PUBLIC_KEY'),

    /*
    |--------------------------------------------------------------------------
    | VAPID Private Key
    |--------------------------------------------------------------------------
    */

    'vapid_private_key' => env('VAPID_PRIVATE_KEY'),

    /*
    |--------------------------------------------------------------------------
    | VAPID Subject
    |--------------------------------------------------------------------------
    |
    | A URL or mailto: address identifying the sender, required by the
    | Web Push protocol.
    |
    */

    'vapid_subject' => env('VAPID_SUBJECT', 'mailto:hello@charpsdev.com'),

];
