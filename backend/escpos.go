package main

import (
	"bytes"
	"fmt"
	"strings"
)

const (
	escInit      = "\x1b\x40"
	escAlignLeft = "\x1b\x61\x00"
	escAlignCtr  = "\x1b\x61\x01"
	escBoldOn    = "\x1b\x45\x01"
	escBoldOff   = "\x1b\x45\x00"
	escDoubleOn  = "\x1d\x21\x11"
	escDoubleOff = "\x1d\x21\x00"
	escCut       = "\x1d\x56\x01"
)

// receiptWidth is the character width of a line on a standard 58mm thermal
// printer at the default font (the common size for cheap Bluetooth POS
// printers). 80mm printers are usually 48 columns.
const receiptWidth = 32

func buildReceiptESCPOS(b Bill) []byte {
	var buf bytes.Buffer
	buf.WriteString(escInit)

	buf.WriteString(escAlignCtr)
	buf.WriteString(escBoldOn)
	buf.WriteString(escDoubleOn)
	buf.WriteString("NAMMA IDLI\n")
	buf.WriteString(escDoubleOff)
	buf.WriteString(escBoldOff)
	buf.WriteString(strings.Repeat("-", receiptWidth) + "\n")

	buf.WriteString(escAlignLeft)
	buf.WriteString(fmt.Sprintf("Bill #%d\n", b.ID))
	buf.WriteString(b.CreatedAt.Local().Format("02 Jan 2006  03:04 PM") + "\n")
	if b.CustomerName != "" {
		buf.WriteString("Customer: " + b.CustomerName + "\n")
	}
	if b.PaymentMethod != "" {
		buf.WriteString("Payment: " + strings.ToUpper(b.PaymentMethod) + "\n")
	}
	buf.WriteString(strings.Repeat("-", receiptWidth) + "\n")

	for _, it := range b.Items {
		buf.WriteString(truncate(it.ItemName, receiptWidth) + "\n")
		qtyPrice := "  Amount"
		if it.Quantity > 0 {
			qtyPrice = fmt.Sprintf("  %d x Rs.%.2f", it.Quantity, it.UnitPrice)
		}
		lineTotal := fmt.Sprintf("Rs.%.2f", it.LineTotal)
		buf.WriteString(padLine(qtyPrice, lineTotal, receiptWidth) + "\n")
	}
	buf.WriteString(strings.Repeat("-", receiptWidth) + "\n")

	buf.WriteString(escBoldOn)
	buf.WriteString(padLine("TOTAL", fmt.Sprintf("Rs.%.2f", b.TotalAmount), receiptWidth) + "\n")
	buf.WriteString(escBoldOff)
	buf.WriteString(strings.Repeat("-", receiptWidth) + "\n")

	buf.WriteString(escAlignCtr)
	buf.WriteString("Thank you, visit again!\n")
	buf.WriteString("\n\n\n")
	buf.WriteString(escCut)

	return buf.Bytes()
}

func truncate(s string, width int) string {
	if len(s) <= width {
		return s
	}
	return s[:width]
}

// padLine lays out left and right on one line, padding the middle with
// spaces so right ends flush at the given column width.
func padLine(left, right string, width int) string {
	space := width - len(left) - len(right)
	if space < 1 {
		space = 1
	}
	return left + strings.Repeat(" ", space) + right
}
