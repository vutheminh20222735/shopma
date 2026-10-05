export const orderRow = (o: any) => ({ ...o, items: JSON.parse(o.items) });

/** Gắn trạng thái đánh giá từng sản phẩm trong đơn (cho khách). */
export function orderRowWithReviews(o: any, reviewedProductIds: Set<string>) {
    const base = orderRow(o);
    const deliveredPaid = o.status === 'delivered' && o.payment_status === 'paid' && o.refund_status !== 'refunded';
    const items = base.items.map((item: any) => {
        const reviewed = reviewedProductIds.has(item.product_id);
        return {
            ...item,
            reviewed,
            can_review: deliveredPaid && !reviewed,
        };
    });
    const pendingReview = items.filter((i: any) => i.can_review);
    // Một product_id có thể lặp trong đơn (nhiều size) — chỉ cần đánh giá 1 lần/sản phẩm.
    const uniquePending = [...new Map(pendingReview.map((i: any) => [i.product_id, i])).values()];
    return {
        ...base,
        items,
        received: deliveredPaid,
        review_pending: uniquePending.map((i: any) => ({ product_id: i.product_id, name: i.name, image: i.image })),
        all_reviewed: deliveredPaid && uniquePending.length === 0 && items.some((i: any) => i.reviewed),
    };
}
