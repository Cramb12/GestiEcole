-- =====================================================================
-- Migration 011 — Auto-installation de la structure standard d'une école
-- Une école créée par inscription self-service n'avait AUCUN niveau (ni
-- périodes ni créneaux), donc impossible de créer une classe. Cette fonction
-- installe la structure officielle RDC pour une école donnée. Idempotente.
-- Appelée par la fonction Edge create-school après création de l'école.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.provision_school_structure(eid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  an   TEXT;
  d    TEXT[];
  nid  UUID;
  pid  UUID;
  pnum INT;
  pnom TEXT;
  nivdef TEXT[] := ARRAY[
    'Élémentaire|primaire|trimestre|elementaire',
    'Moyen|primaire|trimestre|moyen',
    'Terminal|primaire|trimestre|terminal',
    'Cycle d''Orientation|secondaire|semestre|cteb',
    'Humanités|secondaire|semestre|humanites'
  ];
  item TEXT;
BEGIN
  -- Idempotent : ne rien faire si l'école a déjà des niveaux.
  IF EXISTS (SELECT 1 FROM niveaux WHERE ecole_id = eid) THEN RETURN; END IF;
  SELECT annee_scolaire INTO an FROM ecole WHERE id = eid;

  FOREACH item IN ARRAY nivdef LOOP
    d := string_to_array(item, '|');   -- [nom, type, systeme, template]
    INSERT INTO niveaux (ecole_id, nom, type, systeme_periodes, bulletin_template)
      VALUES (eid, d[1], d[2], d[3], d[4]) RETURNING id INTO nid;

    IF d[3] = 'trimestre' THEN
      FOR pnum IN 1..3 LOOP
        pnom := (CASE pnum WHEN 1 THEN '1er' WHEN 2 THEN '2ème' ELSE '3ème' END) || ' Trimestre';
        INSERT INTO periodes (ecole_id, nom, type, niveau_id, numero, annee_scolaire)
          VALUES (eid, pnom, 'trimestre', nid, pnum, COALESCE(an, '')) RETURNING id INTO pid;
        INSERT INTO sous_periodes (ecole_id, periode_id, numero, statut)
          VALUES (eid, pid, 1, 'ouverte'), (eid, pid, 2, 'ouverte');
      END LOOP;
    ELSE
      FOR pnum IN 1..2 LOOP
        pnom := (CASE pnum WHEN 1 THEN '1er' ELSE '2ème' END) || ' Semestre';
        INSERT INTO periodes (ecole_id, nom, type, niveau_id, numero, annee_scolaire)
          VALUES (eid, pnom, 'semestre', nid, pnum, COALESCE(an, '')) RETURNING id INTO pid;
        INSERT INTO sous_periodes (ecole_id, periode_id, numero, statut)
          VALUES (eid, pid, 1, 'ouverte'), (eid, pid, 2, 'ouverte');
      END LOOP;
    END IF;
  END LOOP;

  -- Créneaux par défaut (matinée), si l'école n'en a pas.
  IF NOT EXISTS (SELECT 1 FROM creneaux WHERE ecole_id = eid) THEN
    INSERT INTO creneaux (ecole_id, ordre, label, heure_debut, heure_fin, type) VALUES
      (eid, 1, '1ère heure', '07:30', '08:20', 'cours'),
      (eid, 2, '2ème heure', '08:20', '09:10', 'cours'),
      (eid, 3, '3ème heure', '09:10', '10:00', 'cours'),
      (eid, 4, 'Récréation', '10:00', '10:15', 'pause'),
      (eid, 5, '4ème heure', '10:15', '11:05', 'cours'),
      (eid, 6, '5ème heure', '11:05', '11:55', 'cours'),
      (eid, 7, '6ème heure', '11:55', '12:45', 'cours');
  END IF;
END $$;
