// src/config/permissions.js
// รายการ Permission ทั้งหมดที่ใช้ในระบบ
// เมื่อเพิ่มหน้าใหม่ ให้เพิ่ม permission ที่นี่

export const ALL_PERMISSIONS = [
  {
    key: 'nutrition',
    label: 'คำนวณโภชนาการ',
    icon: '🧮',
    description: 'เข้าถึงหน้าคำนวณโภชนาการ, คำนวณต้นทุน, วิเคราะห์สถิติ'
  },
  {
    key: 'thai-rdi',
    label: 'ฉลากโภชนาการ',
    icon: '🏷️',
    description: 'เข้าถึงหน้าฉลากโภชนาการ Thai RDI'
  },
  {
    key: 'recipes',
    label: 'สูตรอาหาร',
    icon: '📖',
    description: 'เข้าถึงหน้าสูตรอาหาร'
  },
  {
    key: 'compare',
    label: 'เปรียบเทียบสูตร',
    icon: '📊',
    description: 'เข้าถึงหน้าเปรียบเทียบสูตรอาหาร'
  },
  {
    key: 'manage-items',
    label: 'จัดการวัตถุดิบ',
    icon: '🥗',
    description: 'เพิ่ม/แก้ไข/ลบวัตถุดิบในระบบ'
  },
  {
    key: 'admin',
    label: 'Admin Console',
    icon: '⚙️',
    description: 'เข้าถึงหน้า Admin Console'
  },
 {
    key: 'nutrition',
    label: 'อายุการเก็บรักษา',
    icon: '⏱️',
    description: 'เข้าถึงหน้าอายุการเก็บรักษา'
  },
  {
    key: 'manage-roles',
    label: 'จัดการบทบาท',
    icon: '👥',
    description: 'สร้าง/แก้ไข/ลบบทบาทในระบบ'
  }
];

// Permission เริ่มต้นสำหรับแต่ละ Role
export const DEFAULT_ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS.map(p => p.key), // Owner มีทุก permission
  admin: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'manage-items', 'admin', 'manage-roles', 'nutrition'],
  editor: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'manage-items', 'nutrition'],
  moderator: ['nutrition', 'thai-rdi', 'recipes', 'compare'],
  teacher: ['nutrition', 'thai-rdi', 'recipes', 'compare'],
  student: ['nutrition', 'thai-rdi', 'recipes', 'compare'],
  user: ['nutrition', 'thai-rdi', 'recipes', 'compare']
};

// ฟังก์ชันตรวจสอบและอัพเดท permissions ใน Firebase
export const syncPermissionsToFirebase = async (db, setDoc, doc, getDoc) => {
  try {
    const rolesRef = doc(db, 'roles');
    
    for (const [roleKey, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleDoc = await getDoc(doc(db, 'roles', roleKey));
      
      if (roleDoc.exists()) {
        const existingPermissions = roleDoc.data().permissions || [];
        
        // ตรวจสอบว่ามี permission ใหม่ที่ยังไม่มีใน Firebase หรือไม่
        const newPermissions = permissions.filter(p => !existingPermissions.includes(p));
        
        if (newPermissions.length > 0) {
          // อัพเดทเฉพาะ permissions ใหม่
          await setDoc(doc(db, 'roles', roleKey), {
            ...roleDoc.data(),
            permissions: [...existingPermissions, ...newPermissions]
          }, { merge: true });
          
          console.log(`Updated ${roleKey} with new permissions:`, newPermissions);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error syncing permissions:', error);
    return false;
  }
};

export default ALL_PERMISSIONS;
