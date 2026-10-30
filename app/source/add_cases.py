"""Add two test customers whose returns go to a store associate (run once; idempotent)."""
import json, pathlib
p = pathlib.Path(__file__).parent / 'src' / 'data.json'
d = json.loads(p.read_text())
NEW = [
  dict(case=dict(case_id='elena', label='Elena', tag='Over $250', headline='$289 knee-high boots, sole coming away', customer_id='C-90034', order_id='O-58241', line_id='L1', return_id='R-90223',
                 words="The sole is peeling away from the toe of the left boot after a week. For $289 I expected better.",
                 photo=dict(file='IMG_2231.jpg', grade='B', consistent=True, findings=['Sole separating from the upper at the left toe', 'Light, even wear on the outsoles', 'Upper and zip in good condition']),
                 expect=dict(status='options_ready')),
       sku='ST-4410-BLK-8-M', style='ST-4410', product='Thorne knee-high boot', size='8', price=289.0, ordered='2026-10-02', delivered='2026-10-06', name='Elena'),
  dict(case=dict(case_id='noah', label='Noah', tag='Unclear photo', headline='Heel coming apart, photo doesn\'t show it', customer_id='C-90030', order_id='O-58242', line_id='L1', return_id='R-90224',
                 words="The heel on the right shoe is coming apart from the sole. It wobbles when I walk.",
                 photo=dict(file='IMG_2240.jpg', grade='A', consistent=False, findings=['Both heels look firmly attached', 'No gap where the heel meets the sole', 'Soles barely worn']),
                 expect=dict(status='human_review')),
       sku='ST-6020-BLK-7.5-M', style='ST-6020', product='Vera block heel', size='7.5', price=110.0, ordered='2026-10-01', delivered='2026-10-05', name='Noah'),
]
for n in NEW:
    c = n['case']
    d['cases'] = [x for x in d['cases'] if x['case_id'] != c['case_id']] + [c]
    d['orders'] = [o for o in d['orders'] if o['order_id'] != c['order_id']] + [dict(order_id=c['order_id'], customer_id=c['customer_id'], order_date=n['ordered'], channel='Online', country='CA', store_or_ecom='E-commerce',
        lines=[dict(line_id='L1', sku=n['sku'], style_id=n['style'], product=n['product'], colour='Black', size=n['size'], width='M', quantity=1, selling_price=n['price'], discount=0.0, promotion='', final_sale=False)],
        shipping_method='Standard', shipping_cost=0.0, fulfilment_location='DC-MTL', estimated_delivery_date=n['delivered'], delivery_date=n['delivered'])]
    tr = [t for t in d['tracking'] if t['order_id'] != c['order_id']]
    tr.append(dict(order_id=c['order_id'], events=[[n['ordered'], 'Picked up', 'Montreal', ''], [n['delivered'], 'Delivered', 'Greater Montreal', '']]))
    d['tracking'] = tr
    for cu in d['customers']:
        if cu['customer_id'] == c['customer_id']: cu['display_name'] = n['name']
p.write_text(json.dumps(d, separators=(',', ':')))
print([x['case_id'] for x in d['cases']])
