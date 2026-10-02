export const orderRow = (o: any) => ({ ...o, items: JSON.parse(o.items) });
