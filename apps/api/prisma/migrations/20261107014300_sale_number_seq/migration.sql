-- Consecutivo de ventas (la Fase 5 lo consume con nextval('sale_number_seq')).
CREATE SEQUENCE "sale_number_seq"
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
