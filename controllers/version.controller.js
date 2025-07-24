const { Document, Version } = require('../models');

exports.createDocument = async (req, res) => {
  const { title, content } = req.body;
  try {
    const document = await Document.create({ title });
    await Version.create({
      content,
      versionNumber: 1,
      DocumentId: document.id,
    });
    res.status(201).json({ message: 'Document created', document });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDocument = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  try {
    const latest = await Version.findOne({
      where: { DocumentId: id },
      order: [['versionNumber', 'DESC']],
    });

    const newVersion = await Version.create({
      content,
      versionNumber: latest.versionNumber + 1,
      DocumentId: id,
    });

    res.json({ message: 'New version created', newVersion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVersions = async (req, res) => {
  const { id } = req.params;
  try {
    const versions = await Version.findAll({
      where: { DocumentId: id },
      order: [['versionNumber', 'DESC']],
    });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
