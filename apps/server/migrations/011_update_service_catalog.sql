CREATE TABLE IF NOT EXISTS service_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  mark TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO service_catalog (id,name,description,detail,mark,active,sortOrder) VALUES
  ('service-gel','Esmaltação em gel','Brilho intenso e durabilidade para manter as unhas bonitas por mais tempo.','Uma camada uniforme, resistente e com acabamento de salão.','GEL',1,1),
  ('service-feet-traditional','Pés tradicional','Cuidado tradicional para os pés, com acabamento limpo e delicado.','Cutilagem, formato, esmaltação e finalização para um resultado clássico.','PÉS',1,2),
  ('service-hands-traditional','Mãos tradicional','Cuidado tradicional para as mãos, com acabamento limpo e delicado.','Cutilagem, formato, esmaltação e finalização para um resultado clássico.','MÃOS',1,3),
  ('service-maintenance','Manutenção','Aquele cuidado de continuidade para preservar o formato e o acabamento.','Avaliamos o crescimento e renovamos o que for preciso.','↻',1,4);

INSERT OR IGNORE INTO service_prices (serviceName, priceCents) VALUES
  ('Esmaltação em gel', NULL),
  ('Pés tradicional', NULL),
  ('Mãos tradicional', NULL),
  ('Manutenção', NULL);
