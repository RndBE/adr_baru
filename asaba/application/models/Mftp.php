<?php
class Mftp extends CI_Model{
	
#######--insert Sinkron---######
 function insert_sinkron($data) {
        $this->db->insert('set_sinkronisasi', $data);
	 	return;
    }

function update_sinkron($data)
	{
		
		$this->db->where('idlogger',$this->input->post('id_logger'));
		$this->db->update('set_sinkronisasi', $data);	
		return;

	}
	
function insert_ftp($data,$tabel) {
        $this->db->insert($tabel, $data);
	 	return;
    }
 
}