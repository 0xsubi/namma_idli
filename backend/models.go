package main

import "time"

type Item struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Price     float64   `json:"price"`
	CreatedAt time.Time `json:"created_at"`
}

type ItemRequest struct {
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

type BillItemInput struct {
	ItemName  string  `json:"item_name"`
	UnitPrice float64 `json:"unit_price"`
	Quantity  int     `json:"quantity"`
}

type CreateBillRequest struct {
	CustomerName  string          `json:"customer_name"`
	PaymentMethod string          `json:"payment_method"`
	Items         []BillItemInput `json:"items"`
}

type BillItem struct {
	ID        int64   `json:"id"`
	ItemName  string  `json:"item_name"`
	UnitPrice float64 `json:"unit_price"`
	Quantity  int     `json:"quantity"`
	LineTotal float64 `json:"line_total"`
}

type Bill struct {
	ID            int64      `json:"id"`
	CustomerName  string     `json:"customer_name"`
	PaymentMethod string     `json:"payment_method"`
	TotalAmount   float64    `json:"total_amount"`
	CreatedAt     time.Time  `json:"created_at"`
	Items         []BillItem `json:"items,omitempty"`
}

type CreateSaleRequest struct {
	SaleDate string  `json:"sale_date"`
	Amount   float64 `json:"amount"`
	Notes    string  `json:"notes"`
}

type Sale struct {
	ID        int64     `json:"id"`
	SaleDate  string    `json:"sale_date"`
	Amount    float64   `json:"amount"`
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

type TopItem struct {
	ItemName string  `json:"item_name"`
	Quantity int     `json:"quantity"`
	Revenue  float64 `json:"revenue"`
}

type AnalyticsSummary struct {
	From               string    `json:"from"`
	To                 string    `json:"to"`
	BillCount          int       `json:"bill_count"`
	BillRevenue        float64   `json:"bill_revenue"`
	ManualSalesCount   int       `json:"manual_sales_count"`
	ManualSalesRevenue float64   `json:"manual_sales_revenue"`
	TotalRevenue       float64   `json:"total_revenue"`
	AverageBillValue   float64   `json:"average_bill_value"`
	TopItems           []TopItem `json:"top_items"`
}

type OrderItemInput struct {
	ItemName string `json:"item_name"`
	Quantity int    `json:"quantity"`
}

type CreateOrderRequest struct {
	CustomerName  string           `json:"customer_name"`
	CustomerPhone string           `json:"customer_phone"`
	Notes         string           `json:"notes"`
	Items         []OrderItemInput `json:"items"`
}

type UpdateOrderStatusRequest struct {
	Status string `json:"status"`
}

type ConvertOrderRequest struct {
	PaymentMethod string `json:"payment_method"`
}

type OrderItem struct {
	ID        int64   `json:"id"`
	ItemName  string  `json:"item_name"`
	UnitPrice float64 `json:"unit_price"`
	Quantity  int     `json:"quantity"`
	LineTotal float64 `json:"line_total"`
}

type Order struct {
	ID            int64       `json:"id"`
	CustomerName  string      `json:"customer_name"`
	CustomerPhone string      `json:"customer_phone"`
	Notes         string      `json:"notes"`
	Status        string      `json:"status"`
	TotalAmount   float64     `json:"total_amount"`
	BillID        *int64      `json:"bill_id"`
	CreatedAt     time.Time   `json:"created_at"`
	Items         []OrderItem `json:"items,omitempty"`
}

type PushSubscriptionKeys struct {
	P256dh string `json:"p256dh"`
	Auth   string `json:"auth"`
}

type PushSubscriptionRequest struct {
	Endpoint string               `json:"endpoint"`
	Keys     PushSubscriptionKeys `json:"keys"`
	// ExpirationTime comes from the browser's PushSubscription.toJSON() but
	// isn't used server-side; declared so strict JSON decoding doesn't reject it.
	ExpirationTime *float64 `json:"expirationTime"`
}

type UnsubscribeRequest struct {
	Endpoint string `json:"endpoint"`
}
